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

import {updateRlsBuildForTask} from './BuckIntegration';

const DISCLAIMER = `[nuclide-rust] Support for Buck-managed Rust
projects is currently experimental. For it to work correctly, please build
the target you plan on working using Buck toolbar.`;

class Activation {
  _rustLanguageService: AtomLanguageService<LanguageService>;
  _subscriptions: UniversalDisposable;

  constructor(rawState: ?Object) {
    atom.notifications.addInfo(DISCLAIMER);

    this._rustLanguageService = createRustLanguageService();
    this._rustLanguageService.activate();

    this._subscriptions = new UniversalDisposable(this._rustLanguageService);
  }

  consumeBuckTaskRunner(service: BuckTaskRunnerService): IDisposable {
    return service.onDidCompleteTask(task =>
      updateRlsBuildForTask(task, this._rustLanguageService),
    );
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}

createPackage(module.exports, Activation);
