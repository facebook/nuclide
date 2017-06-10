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

import {Expect} from '../../../nuclide-expected';

export function createEmptyAppState(): AppState {
  return {
    hosts: [''],
    host: '',
    devices: Expect.value([]),
    deviceType: null,
    deviceTypes: [],
    device: null,
    deviceTasks: [],
    infoTables: new Map(),
    processes: [],
    processTasks: [],
    isDeviceConnected: false,
    supportedPidsPerTask: new Map(),
    deviceTypeTasks: [],
  };
}
