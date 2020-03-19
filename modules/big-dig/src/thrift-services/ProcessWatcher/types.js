/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

/**
 * This interface should always match its thrift counterpart
 * TODO autogenerate this
 */

import type {ProcessMessage} from 'nuclide-commons/process.js';

export type ThriftProcessMessage = ProcessMessage;

export interface ThriftProcessWatcherClient {
  nextMessages(
    processId: number,
    waitTimeSec: number,
  ): Promise<Array<ThriftProcessMessage>>;
  unsubscribe(id: number): Promise<void>;
  watchProcess(cmd: string, cmdArgs: Array<string>): Promise<number>;
}
