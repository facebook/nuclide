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
import {SyntacticSelectionManager} from './SyntacticSelectionManager';

import type {SyntacticSelectionProvider} from './types';

class Activation {
  _syntacticSelectionManager: SyntacticSelectionManager;

  constructor() {
    this._syntacticSelectionManager = new SyntacticSelectionManager();
  }

  dispose() {
    this._syntacticSelectionManager.dispose();
  }

  consumeSyntacticSelectionProvider(
    provider: SyntacticSelectionProvider,
  ): IDisposable {
    return this._syntacticSelectionManager.addProvider(provider);
  }
}

createPackage(module.exports, Activation);
