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

export type PtyInfo = {
  terminalType: string,
  environment?: Map<string, string>,
  cwd?: string,
  command?: Command,
};

export interface PtyClient {
  onOutput(data: string): void,
  onExit(code: number, signal: number): void,
  dispose(): void,
}

export interface Pty {
  resize(columns: number, rows: number): void,
  writeInput(data: string): void,
  dispose(): void,
}

export type Command = {
  file: string,
  args: Array<string>,
};
