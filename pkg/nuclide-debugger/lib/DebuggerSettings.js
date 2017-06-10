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

import type {ThreadColumn} from '../../nuclide-debugger-base/lib/types';

export class DebuggerSettings {
  _settings: {
    SupportThreadsWindow: boolean,
    CustomThreadColumns: Array<ThreadColumn>,
    threadsComponentTitle: string,
  };

  constructor() {
    this._settings = {
      SupportThreadsWindow: false,
      SingleThreadStepping: false,
      CustomThreadColumns: [],
      threadsComponentTitle: 'Threads',
    };
  }

  set(key: string, value: mixed): void {
    this._settings[key] = value;
  }

  get(key: string): ?mixed {
    return this._settings[key];
  }

  getSerializedData(): string {
    return JSON.stringify(this._settings);
  }
}
