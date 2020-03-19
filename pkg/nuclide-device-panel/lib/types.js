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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Expected} from 'nuclide-commons/expected';
import type {
  Process,
  Device,
  AppInfoRow,
  ProcessTask,
  Task,
  ComponentPosition,
  DeviceTypeComponent,
} from 'nuclide-debugger-common/types';

import * as Immutable from 'immutable';

//
// Store
//

export type AppState = {|
  hosts: NuclideUri[],
  host: NuclideUri,
  devices: Expected<Device[]>,
  deviceType: ?string,
  deviceTypes: string[],
  device: ?Device,
  infoTables: Expected<Map<string, Map<string, string>>>,
  appInfoTables: Expected<Map<string, Array<AppInfoRow>>>,
  processes: Expected<Process[]>,
  processTasks: ProcessTask[],
  deviceTasks: Map<string, Array<Task>>,
  isDeviceConnected: boolean,
  deviceTypeTasks: Array<Task>,
  isPollingDevices: boolean,
  deviceTypeComponents: Immutable.Map<
    ComponentPosition,
    Immutable.List<DeviceTypeComponent>,
  >,
|};

export type Store = {
  subscribe(() => void): () => void,
  getState(): AppState,
  dispatch(action: Action): void,
};

//
// Action types
//

export type SetDevicesAction = {
  type: 'SET_DEVICES',
  payload: {
    devices: Expected<Device[]>,
  },
};

export type SetHostsAction = {
  type: 'SET_HOSTS',
  payload: {
    hosts: NuclideUri[],
  },
};

export type SetHostAction = {
  type: 'SET_HOST',
  payload: {
    host: NuclideUri,
  },
};

export type SetDeviceTypeAction = {
  type: 'SET_DEVICE_TYPE',
  payload: {
    deviceType: ?string,
  },
};

export type SetDeviceTypesAction = {
  type: 'SET_DEVICE_TYPES',
  payload: {
    deviceTypes: string[],
  },
};

export type SetDeviceAction = {
  type: 'SET_DEVICE',
  payload: {
    device: ?Device,
  },
};

export type SetInfoTablesAction = {
  type: 'SET_INFO_TABLES',
  payload: {
    infoTables: Map<string, Map<string, string>>,
  },
};

export type SetAppInfoTablesAction = {
  type: 'SET_APP_INFO_TABLES',
  payload: {
    appInfoTables: Map<string, Array<AppInfoRow>>,
  },
};

export type SetProcessesAction = {
  type: 'SET_PROCESSES',
  payload: {
    processes: Process[],
  },
};

export type SetProcessTasksAction = {
  type: 'SET_PROCESS_TASKS',
  payload: {
    processTasks: ProcessTask[],
  },
};

export type SetDeviceTasksAction = {
  type: 'SET_DEVICE_TASKS',
  payload: {
    deviceTasks: Map<string, Array<Task>>,
  },
};

export type ToggleDevicePollingAction = {
  type: 'TOGGLE_DEVICE_POLLING',
  payload: {
    isActive: boolean,
  },
};

export type ToggleProcessPollingAction = {
  type: 'TOGGLE_PROCESS_POLLING',
  payload: {
    isActive: boolean,
  },
};

export type SetDeviceTypeTasksAction = {
  type: 'SET_DEVICE_TYPE_TASKS',
  payload: {
    deviceTypeTasks: Array<Task>,
  },
};

export type SetDeviceTypeComponentsAction = {
  type: 'SET_DEVICE_TYPE_COMPONENTS',
  payload: {
    components: Immutable.Map<
      ComponentPosition,
      Immutable.List<DeviceTypeComponent>,
    >,
  },
};

export type Action =
  | ToggleDevicePollingAction
  | ToggleProcessPollingAction
  | SetHostAction
  | SetHostsAction
  | SetDevicesAction
  | SetDeviceTypeAction
  | SetDeviceTypesAction
  | SetInfoTablesAction
  | SetAppInfoTablesAction
  | SetProcessesAction
  | SetProcessTasksAction
  | SetDeviceTasksAction
  | SetDeviceTypeTasksAction
  | SetDeviceAction
  | SetDeviceTypeComponentsAction;
