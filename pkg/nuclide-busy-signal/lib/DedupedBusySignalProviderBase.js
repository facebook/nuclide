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

import type {MessageDisplayOptions} from './BusySignalProviderBase';

import invariant from 'assert';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {BusySignalProviderBase} from './BusySignalProviderBase';

type MessageRecord = {
  // The disposable to call to remove the message
  disposable: IDisposable,
  // The number of messages outstanding
  count: number,
};

export class DedupedBusySignalProviderBase extends BusySignalProviderBase {
  // Invariant: All contained MessageRecords must have a count greater than or equal to one.
  _messageRecords: Map<string, MessageRecord>;

  constructor() {
    super();
    this._messageRecords = new Map();
  }

  displayMessage(
    message: string,
    options?: MessageDisplayOptions,
  ): UniversalDisposable {
    this._incrementCount(message, options);
    return new UniversalDisposable(() => {
      this._decrementCount(message, options);
    });
  }

  _incrementCount(message: string, options?: MessageDisplayOptions): void {
    const key = this._getKey(message, options);
    let record = this._messageRecords.get(key);
    if (record == null) {
      record = {
        disposable: super.displayMessage(message, options),
        count: 1,
      };
      this._messageRecords.set(key, record);
    } else {
      record.count++;
    }
  }

  _decrementCount(message: string, options?: MessageDisplayOptions): void {
    const key = this._getKey(message, options);
    const record = this._messageRecords.get(key);
    invariant(record != null);
    invariant(record.count > 0);
    if (record.count === 1) {
      record.disposable.dispose();
      this._messageRecords.delete(key);
    } else {
      record.count--;
    }
  }

  _getKey(message: string, options?: MessageDisplayOptions): string {
    return JSON.stringify({
      message,
      options,
    });
  }
}
