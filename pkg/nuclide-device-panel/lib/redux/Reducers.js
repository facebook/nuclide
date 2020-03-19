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

import type {Action, AppState} from '../types';
import type {Device} from 'nuclide-debugger-common/types';
import type {Expected} from 'nuclide-commons/expected';

import * as Actions from './Actions';
import * as Immutable from 'immutable';
import {Expect} from 'nuclide-commons/expected';

export function app(state: AppState, action: Action): AppState {
  switch (action.type) {
    case Actions.SET_HOST:
      const {host} = action.payload;
      return {
        ...state,
        device: null,
        devices: Expect.pending(),
        deviceTasks: new Map(),
        infoTables: Expect.pending(),
        processes: Expect.pending(),
        processTasks: [],
        deviceTypeComponents: Immutable.Map(),
        isDeviceConnected: false,
        host,
      };

    case Actions.SET_DEVICE_TYPE:
      const {deviceType} = action.payload;
      if (deviceType === state.deviceType) {
        return state;
      }
      return {
        ...state,
        deviceType,
        device: null,
        devices: Expect.pending(),
        deviceTasks: new Map(),
        infoTables: Expect.pending(),
        processes: Expect.pending(),
        processTasks: [],
        deviceTypeComponents: Immutable.Map(),
        isDeviceConnected: false,
      };

    case Actions.SET_DEVICE_TYPES:
      const {deviceTypes} = action.payload;
      return {
        ...state,
        deviceTypes,
      };

    case Actions.SET_DEVICE:
      const {device} = action.payload;
      return {
        ...state,
        device,
        isDeviceConnected: isDeviceConnected(device, state.devices),
      };

    case Actions.SET_DEVICES:
      const {devices} = action.payload;
      return {
        ...state,
        devices,
        isDeviceConnected: isDeviceConnected(state.device, devices),
      };

    case Actions.SET_INFO_TABLES:
      const {infoTables} = action.payload;
      return {
        ...state,
        infoTables: Expect.value(infoTables),
      };

    case Actions.SET_APP_INFO_TABLES:
      const {appInfoTables} = action.payload;
      return {
        ...state,
        appInfoTables: Expect.value(appInfoTables),
      };

    case Actions.SET_PROCESSES:
      const {processes} = action.payload;
      return {
        ...state,
        processes: Expect.value(processes),
      };

    case Actions.SET_PROCESS_TASKS:
      const {processTasks} = action.payload;
      return {
        ...state,
        processTasks,
      };

    case Actions.SET_HOSTS:
      const {hosts} = action.payload;
      return {
        ...state,
        hosts,
      };

    case Actions.SET_DEVICE_TASKS:
      const {deviceTasks} = action.payload;
      return {
        ...state,
        deviceTasks,
      };

    case Actions.SET_DEVICE_TYPE_TASKS:
      const {deviceTypeTasks} = action.payload;
      return {
        ...state,
        deviceTypeTasks,
      };

    case Actions.SET_DEVICE_TYPE_COMPONENTS:
      const deviceTypeComponents = action.payload.components;
      return {
        ...state,
        deviceTypeComponents,
      };

    case Actions.TOGGLE_DEVICE_POLLING:
      const {isActive} = action.payload;
      return {
        ...state,
        isPollingDevices: isActive,
      };

    default:
      return state;
  }
}

function isDeviceConnected(
  device: ?Device,
  deviceList: Expected<Device[]>,
): boolean {
  if (device == null || !deviceList.isValue) {
    return false;
  }
  for (const _device of deviceList.value) {
    if (device.identifier === _device.identifier) {
      return true;
    }
  }
  return false;
}
