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

import type {Command} from './pty-service/rpc-types';
import type {Terminal as XTerminalType} from 'xterm';

export type Terminal = TerminalClass;
interface TerminalClass extends XTerminalType {
  proposeGeometry: () => {rows: number, cols: number};
  fit: () => void;
  webLinksInit: (handler?: (event: Event, link: string) => void) => void;

  // TODO: Update xterm types?
  linkifier: any;
  buffer: any;
  selectionManager: any;
  dispose: () => void;
}

export type TerminalInfo = {
  title?: string,
  key?: string,
  remainOnCleanExit?: boolean,
  defaultLocation?: atom$PaneLocation | 'pane',
  icon?: string,
  command?: Command,
  cwd?: ?string,
  environmentVariables?: Map<string, string>,
  preservedCommands?: Array<string>,
  initialInput?: string,
};

export interface TerminalInstance {
  onSpawn(callback: () => mixed): IDisposable;
  setProcessExitCallback(callback: () => mixed): void;
  terminateProcess(): void;
}

export type TerminalApi = {
  open(info: TerminalInfo): Promise<TerminalInstance>,
  close(key: string): void,
};
