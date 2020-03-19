/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import {Emitter} from 'atom';
import {groupBy} from 'lodash';
import memoizeUntilChanged from 'nuclide-commons/memoizeUntilChanged';
import {WorkingSet} from '../../nuclide-working-sets-common';
import {arrayEqual, arrayUnique} from 'nuclide-commons/collection';
import {track} from 'nuclide-analytics';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';

import type {WorkingSetDefinition} from './types';

type ApplicabilitySortedDefinitions = {
  applicable: Array<WorkingSetDefinition>,
  notApplicable: Array<WorkingSetDefinition>,
};

const NEW_WORKING_SET_EVENT = 'new-working-set';
const NEW_DEFINITIONS_EVENT = 'new-definitions';
const SAVE_DEFINITIONS_EVENT = 'save-definitions';

export class WorkingSetsStore {
  _emitter: Emitter;
  _current: WorkingSet;
  _userDefinitions: Array<WorkingSetDefinition> = [];
  _projectDefinitions: Array<WorkingSetDefinition> = [];
  _prevApplicability: {|
    applicable: Array<WorkingSetDefinition>,
    notApplicable: Array<WorkingSetDefinition>,
  |};
  _lastSelected: Array<string>;
  _groupByApplicability: typeof groupByApplicability = memoizeUntilChanged(
    groupByApplicability,
    definitions => ({
      definitions,
      // Atom just keeps modifying the same array so we need to make a copy here if we want to
      // compare to a later value.
      projectRoots: atom.project.getDirectories().slice(),
    }),
    (a, b) =>
      arrayEqual(a.definitions, b.definitions) &&
      arrayEqual(a.projectRoots, b.projectRoots),
  );

  constructor() {
    this._emitter = new Emitter();
    this._current = new WorkingSet();
    this._prevApplicability = {
      applicable: [],
      notApplicable: [],
    };
    this._lastSelected = [];

    // Don't recompute definitions unless one of the properties it's derived from changes.
    (this: any).getDefinitions = memoizeUntilChanged(
      this.getDefinitions,
      () => [this._userDefinitions, this._projectDefinitions],
    );
  }

  getCurrent(): WorkingSet {
    return this._current;
  }

  getDefinitions(): Array<WorkingSetDefinition> {
    return [...this._userDefinitions, ...this._projectDefinitions];
  }

  getApplicableDefinitions(): Array<WorkingSetDefinition> {
    return this._groupByApplicability(this.getDefinitions()).applicable;
  }

  getNotApplicableDefinitions(): Array<WorkingSetDefinition> {
    return this._groupByApplicability(this.getDefinitions()).notApplicable;
  }

  subscribeToCurrent(callback: (current: WorkingSet) => void): IDisposable {
    return this._emitter.on(NEW_WORKING_SET_EVENT, callback);
  }

  subscribeToDefinitions(
    callback: (definitions: ApplicabilitySortedDefinitions) => mixed,
  ): IDisposable {
    return this._emitter.on(NEW_DEFINITIONS_EVENT, callback);
  }

  onSaveDefinitions(
    callback: (definitions: Array<WorkingSetDefinition>) => mixed,
  ): IDisposable {
    return this._emitter.on(SAVE_DEFINITIONS_EVENT, callback);
  }

  updateUserDefinitions(definitions: Array<WorkingSetDefinition>): void {
    if (arrayEqual(this._userDefinitions, definitions)) {
      return;
    }
    this._updateDefinitions([...this._projectDefinitions, ...definitions]);
  }

  updateProjectDefinitions(definitions: Array<WorkingSetDefinition>): void {
    if (arrayEqual(this._projectDefinitions, definitions)) {
      return;
    }
    this._updateDefinitions([...this._userDefinitions, ...definitions]);
  }

  updateApplicability(): void {
    const {
      applicable: prevApplicableDefinitions,
      notApplicable: prevNotApplicableDefinitions,
    } = this._prevApplicability;
    const {applicable, notApplicable} = this._groupByApplicability(
      this.getDefinitions(),
    );

    if (
      arrayEqual(prevApplicableDefinitions, applicable) &&
      arrayEqual(prevNotApplicableDefinitions, notApplicable)
    ) {
      return;
    }

    this._prevApplicability = {applicable, notApplicable};
    const activeApplicable = applicable.filter(d => d.active);
    if (activeApplicable.length > 0) {
      this._lastSelected = activeApplicable.map(d => d.name);
    }
    this._emitter.emit(NEW_DEFINITIONS_EVENT, {applicable, notApplicable});

    // Create a working set to reflect the combination of the active definitions.
    const combinedUris = [].concat(...activeApplicable.map(d => d.uris));
    const newWorkingSet = new WorkingSet(combinedUris);
    if (!this._current.equals(newWorkingSet)) {
      this._current = newWorkingSet;
      this._emitter.emit(NEW_WORKING_SET_EVENT, newWorkingSet);
    }
  }

  saveWorkingSet(name: string, workingSet: WorkingSet): void {
    this._updateDefinition(name, name, workingSet);
  }

  update(name: string, newName: string, workingSet: WorkingSet): void {
    this._updateDefinition(name, newName, workingSet);
  }

  activate(name: string): void {
    this._activateDefinition(name, /* active */ true);
  }

  deactivate(name: string): void {
    this._activateDefinition(name, /* active */ false);
  }

  deleteWorkingSet(name: string): void {
    track('working-sets-delete', {name});

    const definitions = this.getDefinitions().filter(
      d => d.name !== name || d.sourceType === 'project',
    );
    this._updateDefinitions(definitions);
  }

  _updateDefinition(
    name: string,
    newName: string,
    workingSet: WorkingSet,
  ): void {
    const definitions = this.getDefinitions();

    let nameIndex = -1;
    definitions.forEach((d, i) => {
      if (d.name === name) {
        nameIndex = i;
      }
    });

    // FIXME: We shouldn't be using `repositoryForDirectorySync()`. It's a bad internal API.
    // `atom.project.repositoryForDirectory()` is the "right" one but, unfortunately,
    // `WorkingSetsStore` is currently written to require this to be synchronous.
    const repos = atom.project
      .getDirectories()
      .filter(dir => workingSet.containsDir(dir.getPath()))
      .map(dir => repositoryForDirectorySync(dir))
      .filter(Boolean);
    const originURLs = arrayUnique(
      repos.map(repo => repo.getOriginURL()).filter(Boolean),
    );

    let newDefinitions;
    if (nameIndex < 0) {
      track('working-sets-create', {
        name,
        uris: workingSet.getUris().join(','),
        originURLs: originURLs.join(','),
      });

      newDefinitions = definitions.concat({
        name,
        uris: workingSet.getUris(),
        active: false,
        originURLs,
        sourceType: 'user',
      });
    } else {
      track('working-sets-update', {
        oldName: name,
        name: newName,
        uris: workingSet.getUris().join(','),
        originURLs: originURLs.join(','),
      });

      const definition = definitions[nameIndex];
      newDefinitions = [].concat(
        definitions.slice(0, nameIndex),
        {
          ...definition,
          name: newName,
          uris: workingSet.getUris(),
          originURLs,
        },
        definitions.slice(nameIndex + 1),
      );
    }

    this._updateDefinitions(newDefinitions);
  }

  _activateDefinition(name: string, active: boolean): void {
    track('working-sets-activate', {name, active: active.toString()});

    const definitions = this.getDefinitions();
    const newDefinitions = definitions.map(d => ({
      ...d,
      active: d.name === name ? active : d.active,
    }));
    this._updateDefinitions(newDefinitions);
  }

  deactivateAll(): void {
    const definitions = this.getDefinitions().map(d => {
      if (!isApplicable(d)) {
        return d;
      }

      return {...d, active: false};
    });
    this._updateDefinitions(definitions);
  }

  toggleLastSelected(): void {
    track('working-sets-toggle-last-selected');

    if (this.getApplicableDefinitions().some(d => d.active)) {
      this.deactivateAll();
    } else {
      const newDefinitions = this.getDefinitions().map(d => {
        return {
          ...d,
          active: d.active || this._lastSelected.indexOf(d.name) > -1,
        };
      });
      this._updateDefinitions(newDefinitions);
    }
  }

  // Update the working set definitions. All updates should go through this method! In other words,
  // this should be the only place where `_userDefinitions` and `_projectDefinitions` are changed.
  _updateDefinitions(definitions: Array<WorkingSetDefinition>): void {
    const {userDefinitions, projectDefinitions} = groupBy(
      definitions,
      d =>
        d.sourceType === 'project' ? 'projectDefinitions' : 'userDefinitions',
    );
    this._projectDefinitions = projectDefinitions || [];
    this._userDefinitions = userDefinitions || [];
    this._emitter.emit(SAVE_DEFINITIONS_EVENT, this.getDefinitions());
    this.updateApplicability();
  }
}

function groupByApplicability(
  definitions: Array<WorkingSetDefinition>,
): ApplicabilitySortedDefinitions {
  const applicable = [];
  const notApplicable = [];

  definitions.forEach(def => {
    if (isApplicable(def)) {
      applicable.push(def);
    } else {
      notApplicable.push(def);
    }
  });

  return {applicable, notApplicable};
}

function isApplicable(definition: WorkingSetDefinition): boolean {
  const originURLs = definition.originURLs;
  if (originURLs != null) {
    const mountedOriginURLs = atom.project
      .getRepositories()
      .filter(Boolean)
      .map(repo => repo.getOriginURL());
    originURLs.forEach(originURL => {
      if (mountedOriginURLs.some(url => url === originURL)) {
        return true;
      }
    });
  }

  const workingSet = new WorkingSet(definition.uris);
  const dirs = atom.project.getDirectories().filter(dir => {
    // Apparently sometimes Atom supplies an invalid directory, or a directory with an
    // invalid paths. See https://github.com/facebook/nuclide/issues/416
    if (dir == null) {
      const logger = getLogger('nuclide-working-sets');

      logger.warn('Received a null directory from Atom');
      return false;
    }
    try {
      nuclideUri.parse(dir.getPath());
      return true;
    } catch (e) {
      const logger = getLogger('nuclide-working-sets');

      logger.warn('Failed to parse path supplied by Atom', dir.getPath());
      return false;
    }
  });

  return dirs.some(dir => workingSet.containsDir(dir.getPath()));
}

function repositoryForDirectorySync(dir: atom$Directory): ?atom$Repository {
  // $FlowIgnore: This is an internal API. We really shouldn't use it.
  for (const provider of atom.project.repositoryProviders) {
    const repo = provider.repositoryForDirectorySync(dir);
    if (repo != null) {
      return repo;
    }
  }
  return null;
}
