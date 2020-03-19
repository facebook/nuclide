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

import CwdApi from './CwdApi';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getAtomProjectRootPath} from 'nuclide-commons-atom/projects';
import getElementFilePath from 'nuclide-commons-atom/getElementFilePath';

export default class Activation {
  _cwdApi: CwdApi;
  _disposables: UniversalDisposable;
  _lastWorkingRootPath: ?string;
  _currentWorkingRootDirectory: ?string;

  constructor(rawState: ?Object) {
    const state = rawState || {};
    const {initialCwdPath} = state;
    this._cwdApi = new CwdApi(initialCwdPath);
    this._currentWorkingRootDirectory = this._cwdApi.getCwd();
    this._disposables = new UniversalDisposable(
      this._cwdApi,
      atom.commands.add(
        'atom-workspace',
        'nuclide-current-working-root:set-from-active-file',
        this._setFromActiveFile.bind(this),
      ),
      atom.commands.add(
        'atom-workspace',
        'nuclide-current-working-root:switch-to-previous',
        this._switchToLastWorkingRoot.bind(this),
      ),
      this._cwdApi.observeCwd(newCwd => {
        if (this._currentWorkingRootDirectory != null) {
          const oldCwd = this._currentWorkingRootDirectory;
          if (newCwd === oldCwd) {
            return;
          }
          this._lastWorkingRootPath = oldCwd;
        }
        this._currentWorkingRootDirectory = newCwd;
      }),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  provideApi(): CwdApi {
    return this._cwdApi;
  }

  serialize(): Object {
    const cwd = this._cwdApi.getCwd();
    return {
      initialCwdPath: cwd,
    };
  }

  _switchToLastWorkingRoot(): void {
    if (this._lastWorkingRootPath != null) {
      this._cwdApi.setCwd(this._lastWorkingRootPath);
    }
  }

  _setFromActiveFile(event: Event): void {
    let path = getElementFilePath(((event.target: any): HTMLElement));
    if (path == null) {
      const editor = atom.workspace.getActiveTextEditor();
      if (editor == null) {
        atom.notifications.addError('No file is currently active.');
        return;
      }

      path = editor.getPath();
      if (path == null) {
        atom.notifications.addError('Active file does not have a path.');
        return;
      }
    }

    const projectRoot = getAtomProjectRootPath(path);
    if (projectRoot == null) {
      atom.notifications.addError('Active file does not belong to a project.');
      return;
    }

    this._cwdApi.setCwd(projectRoot);
  }
}
