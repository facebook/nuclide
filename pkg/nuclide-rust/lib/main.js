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

import type {BuckTaskRunnerService} from '../../nuclide-buck/lib/types';
import type {
  AtomLanguageService,
  LanguageService,
} from '../../nuclide-language-service';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {createRustLanguageService} from './RustLanguage';

class Activation {
  _rustLanguageService: AtomLanguageService<LanguageService>;
  _buckTaskRunnerService: ?BuckTaskRunnerService;
  _subscriptions: UniversalDisposable;

  constructor(rawState: ?Object) {
    this._rustLanguageService = createRustLanguageService();
    this._rustLanguageService.activate();

    this._subscriptions = new UniversalDisposable(this._rustLanguageService);
  }

  consumeBuckTaskRunner(service: BuckTaskRunnerService): IDisposable {
    this._buckTaskRunnerService = service;
    return new UniversalDisposable(() => {
      this._buckTaskRunnerService = null;
    });
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}

createPackage(module.exports, Activation);
