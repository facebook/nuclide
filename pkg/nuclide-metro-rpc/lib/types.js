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

import type {MessageEvent} from 'nuclide-commons/process';

// startMetro error codes
export const NO_METRO_PROJECT_ERROR = 'NoMetroProjectError';
export const METRO_PORT_BUSY_ERROR = 'MetroPortBusyError';

export type ReadyEvent = {type: 'ready'};
export type RestartEvent = {type: 'restarting'};
export type MetroEvent = ReadyEvent | RestartEvent | MessageEvent;

export type MetroStartCommand = {
  command: string,
  cwd: string,
  args?: Array<string>,
};
