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

import pty_types from './gen-nodejs/pty_types';

/**
 * This interface should always match pty.thrift
 * TODO autogenerate this from pty.thrift
 */

export type SpawnArguments = {
  command: string,
  commandArgs: Array<string>,
  envPatches: Object,
  cwd: string,
  name: string,
  cols: number,
  rows: number,
};

export interface ThriftPtyClient {
  disposeId(id: number): Promise<void>;
  poll(id: number, timeoutSec: number): Promise<pty_types.PollEvent>;
  resize(id: number, columns: number, rows: number): Promise<void>;
  setEncoding(id: number, encoding: string): Promise<void>;
  spawn(spawnArguments: SpawnArguments): Promise<number>;
  writeInput(id: number, data: string): Promise<void>;
}
