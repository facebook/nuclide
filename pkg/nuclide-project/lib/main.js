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

import createPackage from 'nuclide-commons-atom/createPackage';
import {observeProjectPaths} from 'nuclide-commons-atom/projects';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';

class Activation {
  _disposables: UniversalDisposable;

  constructor(state: ?mixed) {
    this._disposables = new UniversalDisposable(
      observeProjectPaths(async projectPath => {
        if (nuclideUri.isRemote(projectPath)) {
          return;
        }
        const realPath = await fsPromise.realpath(projectPath);
        if (realPath !== projectPath) {
          atom.notifications.addWarning(
            'You have mounted a non-canonical project path. ' +
              'Nuclide only supports mounting canonical paths as local projects.<br />' +
              '<strong>Some Nuclide features such as Flow might not work properly.</strong>',
            {
              dismissable: true,
              detail: `Mounted path: ${projectPath}\n \n ` +
                `Try re-mounting the canonical project path instead:\n${realPath}`,
            },
          );
        }
      }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
