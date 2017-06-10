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

import type {OutputService} from '../../nuclide-console/lib/types';
import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';

import {DebuggingActivation} from './debugging/DebuggingActivation';
import {PackagerActivation} from './packager/PackagerActivation';
import {ShellActivation} from './shell/ShellActivation';
import {CompositeDisposable} from 'atom';

export default class Activation {
  _debuggingActivation: DebuggingActivation;
  _packagerActivation: PackagerActivation;
  _disposables: IDisposable;

  constructor(state: ?Object) {
    this._disposables = new CompositeDisposable(
      (this._debuggingActivation = new DebuggingActivation()),
      (this._packagerActivation = new PackagerActivation()),
      new ShellActivation(),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeOutputService(api: OutputService): void {
    return this._packagerActivation.consumeOutputService(api);
  }

  consumeCwdApi(api: CwdApi): void {
    return this._packagerActivation.consumeCwdApi(api);
  }
}
