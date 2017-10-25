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

import {ShellMessageManager} from './ShellMessageManager';

export class ShellActivation {
  _shellManager: ?ShellMessageManager;

  constructor() {
    // TODO: Enable following when RN changes land. Don't forget to call dispose in `dispose()`!
    // this._disposables = new UniversalDisposable(
    //   atom.commands.add('atom-workspace', {
    //     'nuclide-react-native:reload-app': () => this._reload(),
    //   }),
    // );
    this._shellManager = null;
  }

  dispose(): void {}

  _reload(): void {
    if (this._shellManager == null) {
      this._shellManager = new ShellMessageManager();
    }
    const message = {
      version: 1,
      target: 'bridge',
      action: 'reload',
    };
    this._shellManager.send(message);
  }
}
