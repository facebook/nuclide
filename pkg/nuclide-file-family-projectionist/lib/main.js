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

import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type {FileFamilyProvider} from '../../nuclide-file-family/lib/types';

import nullthrows from 'nullthrows';
import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {BehaviorSubject} from 'rxjs';
import ProjectionistFileFamilyProvider from './ProjectionistFileFamilyProvider';

class Activation {
  _cwdApis: BehaviorSubject<?CwdApi> = new BehaviorSubject(null);
  _subscriptions: ?UniversalDisposable;

  activate() {
    this._subscriptions = new UniversalDisposable();
  }

  dispose() {
    nullthrows(this._subscriptions).dispose();
  }

  consumeCwdApi(cwdApi: CwdApi): void {
    this._cwdApis.next(cwdApi);
  }

  provideFileFamilyService(): FileFamilyProvider {
    return new ProjectionistFileFamilyProvider(this._cwdApis.asObservable());
  }
}

createPackage(module.exports, Activation);
