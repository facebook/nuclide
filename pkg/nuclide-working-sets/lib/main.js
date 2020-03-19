/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

// $FlowFB
import type ProjectManager from '../../fb-atomprojects/lib/ProjectManager';

import invariant from 'assert';
import createPackage from 'nuclide-commons-atom/createPackage';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {BehaviorSubject, Observable} from 'rxjs';
import {track} from 'nuclide-analytics';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {WorkingSetsStore} from './WorkingSetsStore';
import {WorkingSetsConfig} from './WorkingSetsConfig';
import {PathsObserver} from './PathsObserver';
import {WORKING_SET_PATH_MARKER} from '../../nuclide-working-sets-common/lib/constants';
import extractDefinitionsFromProject from './extractDefinitionsFromProject';

class Activation {
  workingSetsStore: WorkingSetsStore;
  _workingSetsConfig: WorkingSetsConfig;
  _projectManagers: BehaviorSubject<?ProjectManager> = new BehaviorSubject();
  _disposables: UniversalDisposable;

  constructor() {
    this.workingSetsStore = new WorkingSetsStore();
    this._workingSetsConfig = new WorkingSetsConfig();
    this._disposables = new UniversalDisposable();

    this._disposables.add(
      this.workingSetsStore.onSaveDefinitions(definitions => {
        this._workingSetsConfig.setDefinitions(definitions);
      }),
    );

    this._disposables.add(
      this._workingSetsConfig.observeDefinitions(definitions => {
        this.workingSetsStore.updateUserDefinitions(definitions);
      }),
    );

    this._disposables.add(
      this._projectManagers
        .switchMap(
          projectManager =>
            projectManager == null
              ? Observable.of(null)
              : observableFromSubscribeFunction(cb =>
                  projectManager.observeActiveProjectSpec(cb),
                ),
        )
        .subscribe(spec => {
          this.workingSetsStore.updateProjectDefinitions(
            extractDefinitionsFromProject(spec),
          );
        }),
    );

    this._disposables.add(
      atom.project.onDidChangePaths(() => {
        this.workingSetsStore.updateApplicability();
      }),
    );

    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        'working-sets:toggle-last-selected',
        this.workingSetsStore.toggleLastSelected.bind(this.workingSetsStore),
      ),
    );

    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        'working-sets:find-in-active',
        findInActive,
      ),
    );

    this._disposables.add(new PathsObserver(this.workingSetsStore));
  }

  dispose(): void {
    this._disposables.dispose();
  }

  provideWorkingSetsStore(): WorkingSetsStore {
    return this.workingSetsStore;
  }

  consumeProjectManager(projectManager: ProjectManager): IDisposable {
    this._projectManagers.next(projectManager);
    return new UniversalDisposable(() => {
      if (this._projectManagers.getValue() === projectManager) {
        this._projectManagers.next(null);
      }
    });
  }
}

async function findInActive(): Promise<void> {
  const activePane = atom.workspace.getActivePane().element;
  atom.commands.dispatch(activePane, 'project-find:show');

  const allProjectsRemote = atom.project
    .getDirectories()
    .every(dir => nuclideUri.isRemote(dir.getPath()));

  track('find-in-working-set:hotkey', {allProjectsRemote});
  if (!allProjectsRemote) {
    atom.notifications.addWarning(
      "Working set searches don't yet work in local projects",
      {dismissable: true},
    );
    return;
  }

  if (!atom.packages.isPackageActive('find-and-replace')) {
    await atom.packages.activatePackage('find-and-replace');
  }
  const findPackage = atom.packages.getActivePackage('find-and-replace');
  invariant(findPackage, 'find-and-replace package is not active');
  const view = findPackage.mainModule.projectFindView;
  invariant(
    view && view.pathsEditor && view.pathsEditor.setText,
    'find-and-replace internals have changed - please update this code',
  );
  view.pathsEditor.setText(WORKING_SET_PATH_MARKER);
}

createPackage(module.exports, Activation);
