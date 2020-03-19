/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import createPackage from 'nuclide-commons-atom/createPackage';
import {CodeActionManager} from './CodeActionManager';

import type {RegisterIndieLinter} from '../../../index';
import type {CodeActionProvider, CodeActionFetcher} from './types';
import type {DiagnosticUpdater} from '../../atom-ide-diagnostics/lib/types';

class Activation {
  _codeActionManager: CodeActionManager;

  constructor() {
    this._codeActionManager = new CodeActionManager();
  }

  dispose() {
    this._codeActionManager.dispose();
  }

  consumeCodeActionProvider(provider: CodeActionProvider) {
    return this._codeActionManager.addProvider(provider);
  }

  consumeDiagnosticUpdates(diagnosticUpdater: DiagnosticUpdater) {
    return this._codeActionManager.consumeDiagnosticUpdates(diagnosticUpdater);
  }

  provideCodeActionFetcher(): CodeActionFetcher {
    return this._codeActionManager.createCodeActionFetcher();
  }

  consumeIndie(register: RegisterIndieLinter) {
    return this._codeActionManager.consumeIndie(register);
  }
}

createPackage(module.exports, Activation);
