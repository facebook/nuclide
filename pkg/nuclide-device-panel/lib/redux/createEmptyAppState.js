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

import type {AppState} from '../types';

import {Expect} from '../../../commons-node/expected';

export function createEmptyAppState(): AppState {
  return {
    hosts: [''],
    host: '',
    devices: Expect.pendingValue([]),
    deviceType: null,
    deviceTypes: [],
    device: null,
    deviceTasks: [],
    infoTables: Expect.pendingValue(new Map()),
    processes: Expect.pendingValue([]),
    processTasks: [],
    isDeviceConnected: false,
    supportedPidsPerTask: new Map(),
    deviceTypeTasks: [],
    isPollingDevices: false,
  };
}
