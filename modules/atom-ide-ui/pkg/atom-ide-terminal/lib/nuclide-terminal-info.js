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

import type {Command} from './pty-service/rpc-types';

// The external interface TerminalInfo leaves everything optional.
// When we open a terminal we will instantiate missing fields with defaults.
export type InstantiatedTerminalInfo = {
  title: string,
  key: string,
  remainOnCleanExit: boolean,
  defaultLocation: atom$PaneLocation | 'pane',
  icon: string,
  command?: Command,
  cwd: string,
  environmentVariables?: Map<string, string>,
  preservedCommands: Array<string>,
  initialInput: string,
};

export const TERMINAL_URI = 'atom://nuclide-terminal-view';
export const TERMINAL_DEFAULT_LOCATION = 'bottom';
export const TERMINAL_DEFAULT_ICON = 'terminal';
export const TERMINAL_DEFAULT_INFO = {
  remainOnCleanExit: false,
  defaultLocation: TERMINAL_DEFAULT_LOCATION,
  icon: TERMINAL_DEFAULT_ICON,
  initialInput: '',
  title: '',
  cwd: '',
  preservedCommands: [],
};
