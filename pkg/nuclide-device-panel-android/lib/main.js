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

import type {DevicePanelServiceApi} from 'nuclide-debugger-common/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {registerDevicePanelProviders} from './Registration';

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeDevicePanelServiceApi(api: DevicePanelServiceApi): void {
    this._disposables.add(registerDevicePanelProviders(api));
  }
}

createPackage(module.exports, Activation);
