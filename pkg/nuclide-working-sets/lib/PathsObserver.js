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

import nuclideUri from 'nuclide-commons/nuclideUri';

import type {WorkingSetsStore} from './WorkingSetsStore';

export class PathsObserver {
  _prevPaths: Array<string>;
  _workingSetsStore: WorkingSetsStore;
  _disposable: IDisposable;

  constructor(workingSetsStore: WorkingSetsStore) {
    this._prevPaths = atom.project.getPaths();
    this._workingSetsStore = workingSetsStore;

    this._disposable = atom.project.onDidChangePaths(
      this._didChangePaths.bind(this),
    );
  }

  dispose(): void {
    this._disposable.dispose();
  }

  _didChangePaths(_paths: Array<string>): void {
    const paths = _paths.filter(
      p => nuclideUri.isRemote(p) || nuclideUri.isAbsolute(p),
    );
    this._workingSetsStore.updateApplicability();

    const prevPaths = this._prevPaths;
    this._prevPaths = paths;

    const currentWs = this._workingSetsStore.getCurrent();
    const noneShown = !paths.some(p => currentWs.containsDir(p));
    if (noneShown) {
      this._workingSetsStore.deactivateAll();
      return;
    }

    const addedPaths = paths.filter(p => prevPaths.indexOf(p) < 0);
    const pathChangeWasHidden = addedPaths.some(p => !currentWs.containsDir(p));

    // The user added a new project root and the currently active working sets did not let
    // it show. This would feel broken - better deactivate the working sets.
    if (pathChangeWasHidden) {
      this._workingSetsStore.deactivateAll();
    }
  }
}
