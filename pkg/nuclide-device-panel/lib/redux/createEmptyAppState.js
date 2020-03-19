/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {AppState} from '../types';

import {Expect} from 'nuclide-commons/expected';
import * as Immutable from 'immutable';

export function createEmptyAppState(): AppState {
  return {
    hosts: [''],
    host: '',
    devices: Expect.pending(),
    deviceType: null,
    deviceTypes: [],
    device: null,
    deviceTasks: new Map(),
    infoTables: Expect.pending(),
    appInfoTables: Expect.pending(),
    processes: Expect.pending(),
    processTasks: [],
    isDeviceConnected: false,
    deviceTypeTasks: [],
    isPollingDevices: false,
    deviceTypeComponents: Immutable.Map(),
  };
}
