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

import type {DeepLinkService} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import {default as DeepLinkServiceImpl} from './DeepLinkService';

class Activation {
  _service: DeepLinkServiceImpl;

  constructor(state: ?Object): void {
    this._service = new DeepLinkServiceImpl();
  }

  dispose() {
    this._service.dispose();
  }

  provideDeepLinkService(): DeepLinkService {
    // Only expose the public methods of the service.
    return {
      subscribeToPath: this._service.subscribeToPath.bind(this._service),
      sendDeepLink: this._service.sendDeepLink.bind(this._service),
    };
  }
}

createPackage(module.exports, Activation);
