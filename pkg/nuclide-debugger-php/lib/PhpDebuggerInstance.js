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

import type {DebuggerProcessInfo} from '../../nuclide-debugger-base';
import type {PhpDebuggerService as PhpDebuggerServiceType} from '../../nuclide-debugger-php-rpc/lib/PhpDebuggerService';

import {DebuggerInstance} from '../../nuclide-debugger-base';
import {ObservableManager} from './ObservableManager';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export class PhpDebuggerInstance extends DebuggerInstance {
  constructor(
    processInfo: DebuggerProcessInfo,
    rpcService: PhpDebuggerServiceType,
  ) {
    const subscriptions = new UniversalDisposable(
      new ObservableManager(
        rpcService.getNotificationObservable().refCount(),
        rpcService.getOutputWindowObservable().refCount(),
      ),
    );
    super(processInfo, rpcService, subscriptions);
  }
}
