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

import type {ParsedVSAdapter} from './DebuggerAdapterFactory';

import {trackImmediate} from 'nuclide-commons/analytics';

export class Analytics {
  _startTime: Date = new Date();
  _adapter: ?ParsedVSAdapter = null;
  _shutdown: boolean = false;

  setAdapter(adapter: ?ParsedVSAdapter): void {
    this._adapter = adapter;
  }

  async shutdown(error: ?string): Promise<mixed> {
    // Don't double-track sessions
    if (this._shutdown) {
      return Promise.resolve();
    }
    this._shutdown = true;

    const now = new Date();
    const sessionLength = (now.getTime() - this._startTime.getTime()) / 1000;
    const session = {
      sessionLength,
      ...(this._adapter == null ? {} : {adapter: this._adapter}),
      commandLine: process.argv,
      ...(error == null ? {} : {error}),
    };

    await trackImmediate('fbdbg:session', session);
  }
}

export const analytics = new Analytics();
