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

import type {MIStoppedEventResult, StopReason} from './MITypes';

import invariant from 'assert';
import MIProxy from './MIProxy';
import {breakInsertResult, toCommandError} from './MITypes';

export default class ExceptionBreakpoints {
  _throwHelper = '__cxa_throw';
  _client: MIProxy;
  _throwBreakpoint: ?number;
  _stopOnSignals: boolean;

  constructor(client: MIProxy) {
    this._client = client;
    this._stopOnSignals = false;
  }

  shouldIgnoreBreakpoint(result: MIStoppedEventResult): boolean {
    if (this._isSignal(result) && !this._stopOnSignals) {
      return true;
    }

    // it's impossible to get a thrown exception stop if they are disabled,
    // so we don't need to check.

    return false;
  }

  stopEventReason(result: MIStoppedEventResult): ?StopReason {
    if (this._isSignal(result)) {
      return {
        reason: 'exception',
        description: 'Uncaught exception',
      };
    }

    if (this._isOurBreakpoint(result)) {
      return {
        reason: 'exception',
        description: 'Thrown exception',
      };
    }

    return null;
  }

  _isSignal(result: MIStoppedEventResult): boolean {
    return result.reason === 'signal-received';
  }

  _isOurBreakpoint(result: MIStoppedEventResult): boolean {
    if (result.reason !== 'breakpoint-hit') {
      return false;
    }

    const bpt = result.bkptno;
    if (bpt == null) {
      return false;
    }

    return parseInt(bpt, 10) === this._throwBreakpoint;
  }

  async setExceptionBreakpointFilters(filters: Array<string>): Promise<void> {
    this._stopOnSignals = filters.includes('uncaught');
    const enableThrown = filters.includes('thrown');

    if (enableThrown && this._throwBreakpoint == null) {
      return this._setBreakpoint();
    } else if (!enableThrown && this._throwBreakpoint != null) {
      return this._clearBreakpoint();
    }
  }

  async _setBreakpoint(): Promise<void> {
    const result = await this._client.sendCommand(
      `break-insert -f ${this._throwHelper}`,
    );
    if (result.error) {
      throw new Error(
        `Error setting thrown exception breakpoint ${
          toCommandError(result).msg
        }`,
      );
    }

    const bt = breakInsertResult(result);
    this._throwBreakpoint = parseInt(bt.bkpt[0].number, 10);
  }

  async _clearBreakpoint(): Promise<void> {
    const breakpointId = this._throwBreakpoint;
    invariant(breakpointId != null);

    const result = await this._client.sendCommand(
      `break-delete ${breakpointId}`,
    );

    if (result.error) {
      throw new Error(
        `Error clearing thrown exception breakpoint ${
          toCommandError(result).msg
        }`,
      );
    }
  }
}
