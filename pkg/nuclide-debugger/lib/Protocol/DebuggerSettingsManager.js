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

import type DebuggerDomainDispatcher from './DebuggerDomainDispatcher';
import type {SetDebuggerSettingsRequest} from '../../../nuclide-debugger-base/lib/protocol-types';

/**
 * Bridge between Nuclide IPC and RPC debugger settings protocols.
 */
export default class DebuggerSettingsManager {
  _debuggerDispatcher: DebuggerDomainDispatcher;
  _settings: SetDebuggerSettingsRequest;

  constructor(debuggerDispatcher: DebuggerDomainDispatcher) {
    this._debuggerDispatcher = debuggerDispatcher;
    this._settings = {singleThreadStepping: false};
  }

  setSingleThreadStepping(enable: boolean): void {
    this._settings.singleThreadStepping = enable;
  }

  syncToEngine(): void {
    this._debuggerDispatcher.setDebuggerSettings(this._settings);
  }
}
