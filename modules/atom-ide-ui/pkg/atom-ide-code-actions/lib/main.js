/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import createPackage from 'nuclide-commons-atom/createPackage';
import {CodeActionManager} from './CodeActionManager';

import type {CodeActionProvider, CodeActionFetcher} from './types';

class Activation {
  _codeActionManager: CodeActionManager;

  constructor() {
    this._codeActionManager = new CodeActionManager();
  }

  dispose() {
    this._codeActionManager.dispose();
  }

  consumeCodeActionProvider(provider: CodeActionProvider) {
    this._codeActionManager.addProvider(provider);
  }

  provideCodeActionFetcher(): CodeActionFetcher {
    return this._codeActionManager.createCodeActionFetcher();
  }
}

createPackage(module.exports, Activation);
