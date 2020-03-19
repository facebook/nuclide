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

import type {DatatipService} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {DatatipManager} from './DatatipManager';

class Activation {
  _datatipManager: DatatipManager;

  constructor() {
    this._datatipManager = new DatatipManager();
  }

  provideDatatipService(): DatatipService {
    return this._datatipManager;
  }

  dispose() {
    this._datatipManager.dispose();
  }
}

createPackage(module.exports, Activation);
