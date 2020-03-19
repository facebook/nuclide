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

import type {DatatipService} from '../../atom-ide-datatip/lib/types';
import type {SignatureHelpRegistry} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import SignatureHelpManager from './SignatureHelpManager';

class Activation {
  // Lazily initialize SignatureHelpManager once we actually get a provider.
  _manager: ?SignatureHelpManager = null;
  _datatipService: ?DatatipService = null;

  dispose() {
    if (this._manager != null) {
      this._manager.dispose();
    }
  }

  consumeDatatip(datatipService: DatatipService): IDisposable {
    this._datatipService = datatipService;
    if (this._manager != null) {
      this._manager.setDatatipService(datatipService);
    }
    return new UniversalDisposable(() => {
      this._datatipService = null;
      if (this._manager != null) {
        this._manager.setDatatipService(null);
      }
    });
  }

  provideSignatureHelp(): SignatureHelpRegistry {
    return provider => {
      const manager = this._getSignatureHelpManager();
      return manager.consumeSignatureHelp(provider);
    };
  }

  _getSignatureHelpManager(): SignatureHelpManager {
    if (this._manager != null) {
      return this._manager;
    }
    this._manager = new SignatureHelpManager();
    if (this._datatipService != null) {
      this._manager.setDatatipService(this._datatipService);
    }
    return this._manager;
  }
}

createPackage(module.exports, Activation);
