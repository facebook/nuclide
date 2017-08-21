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

import invariant from 'assert';
import {CompositeDisposable} from 'atom';
import {track} from '../../nuclide-analytics';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {WorkingSetsStore} from './WorkingSetsStore';
import {WorkingSetsConfig} from './WorkingSetsConfig';
import {PathsObserver} from './PathsObserver';
import {WORKING_SET_PATH_MARKER} from '../../nuclide-working-sets-common/lib/constants';

class Activation {
  workingSetsStore: WorkingSetsStore;
  _workingSetsConfig: WorkingSetsConfig;
  _disposables: CompositeDisposable;

  constructor() {
    this.workingSetsStore = new WorkingSetsStore();
    this._workingSetsConfig = new WorkingSetsConfig();
    this._disposables = new CompositeDisposable();

    this._disposables.add(
      this.workingSetsStore.onSaveDefinitions(definitions => {
        this._workingSetsConfig.setDefinitions(definitions);
      }),
    );

    this._disposables.add(
      this._workingSetsConfig.observeDefinitions(definitions => {
        this.workingSetsStore.updateDefinitions(definitions);
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

  deactivate(): void {
    this._disposables.dispose();
  }
}

let activation: ?Activation = null;

export function activate() {
  if (activation != null) {
    return;
  }

  activation = new Activation();
}

export function deactivate() {
  if (activation == null) {
    return;
  }

  activation.deactivate();
  activation = null;
}

export function provideWorkingSetsStore(): WorkingSetsStore {
  invariant(
    activation,
    'Was requested to provide service from a non-activated package',
  );

  return activation.workingSetsStore;
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
