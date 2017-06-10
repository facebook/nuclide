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
import type {
  SetDeviceTypesAction,
  SetDeviceTypeAction,
  SetDevicesAction,
  SetDeviceTasksAction,
  SetDeviceAction,
  SetHostsAction,
  SetHostAction,
  SetInfoTablesAction,
  SetProcessesAction,
  SetProcessTasksAction,
  SetDeviceTypeTasksAction,
  ToggleDevicePollingAction,
  ToggleProcessPollingAction,
  Device,
  Process,
  ProcessTask,
} from '../types';
import type {Expected} from '../../../nuclide-expected';

import {DeviceTask} from '../DeviceTask';

export const SET_DEVICE_TYPES = 'SET_DEVICE_TYPES';
export const SET_DEVICE_TYPE = 'SET_DEVICE_TYPE';
export const SET_DEVICES = 'SET_DEVICES';
export const SET_DEVICE = 'SET_DEVICE';
export const SET_DEVICE_TASKS = 'SET_DEVICE_TASKS';
export const SET_HOSTS = 'SET_HOSTS';
export const SET_HOST = 'SET_HOST';
export const SET_INFO_TABLES = 'SET_INFO_TABLES';
export const SET_PROCESSES = 'SET_PROCESSES';
export const SET_PROCESS_TASKS = 'SET_PROCESS_TASKS';
export const TOGGLE_DEVICE_POLLING = 'TOGGLE_DEVICE_POLLING';
export const TOGGLE_PROCESS_POLLING = 'TOGGLE_PROCESS_POLLING';
export const SET_DEVICE_TYPE_TASKS = 'SET_DEVICE_TYPE_TASKS';

export function toggleDevicePolling(
  isActive: boolean,
): ToggleDevicePollingAction {
  return {
    type: TOGGLE_DEVICE_POLLING,
    payload: {isActive},
  };
}

export function toggleProcessPolling(
  isActive: boolean,
): ToggleProcessPollingAction {
  return {
    type: TOGGLE_PROCESS_POLLING,
    payload: {isActive},
  };
}

export function setInfoTables(
  infoTables: Map<string, Map<string, string>>,
): SetInfoTablesAction {
  return {
    type: SET_INFO_TABLES,
    payload: {infoTables},
  };
}

export function setProcesses(processes: Process[]): SetProcessesAction {
  return {
    type: SET_PROCESSES,
    payload: {processes},
  };
}

export function setProcessTasks(
  processTasks: ProcessTask[],
): SetProcessTasksAction {
  return {
    type: SET_PROCESS_TASKS,
    payload: {processTasks},
  };
}

export function setDevices(devices: Expected<Device[]>): SetDevicesAction {
  return {
    type: SET_DEVICES,
    payload: {devices},
  };
}

export function setHosts(hosts: NuclideUri[]): SetHostsAction {
  return {
    type: SET_HOSTS,
    payload: {hosts},
  };
}

export function setHost(host: NuclideUri): SetHostAction {
  return {
    type: SET_HOST,
    payload: {host},
  };
}

export function setDeviceType(deviceType: ?string): SetDeviceTypeAction {
  return {
    type: SET_DEVICE_TYPE,
    payload: {deviceType},
  };
}

export function setDeviceTypes(deviceTypes: string[]): SetDeviceTypesAction {
  return {
    type: SET_DEVICE_TYPES,
    payload: {deviceTypes},
  };
}

export function setDevice(device: ?Device): SetDeviceAction {
  return {
    type: SET_DEVICE,
    payload: {device},
  };
}

export function setDeviceTasks(
  deviceTasks: DeviceTask[],
): SetDeviceTasksAction {
  return {
    type: SET_DEVICE_TASKS,
    payload: {deviceTasks},
  };
}

export function setDeviceTypeTasks(
  deviceTypeTasks: DeviceTask[],
): SetDeviceTypeTasksAction {
  return {
    type: SET_DEVICE_TYPE_TASKS,
    payload: {deviceTypeTasks},
  };
}
