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

import {
  DeviceListProvider,
  DeviceInfoProvider,
  DeviceProcessesProvider,
  DeviceTaskProvider,
  DeviceProcessTaskProvider,
  DeviceTypeTaskProvider,
} from './types';

type DeviceProviders = {
  deviceList: Set<DeviceListProvider>,
  deviceInfo: Set<DeviceInfoProvider>,
  deviceTask: Set<DeviceTaskProvider>,
  deviceProcesses: Set<DeviceProcessesProvider>,
  processTask: Set<DeviceProcessTaskProvider>,
  deviceTypeTask: Set<DeviceTypeTaskProvider>,
};

const providers: DeviceProviders = {
  deviceList: new Set(),
  deviceInfo: new Set(),
  deviceTask: new Set(),
  deviceProcesses: new Set(),
  processTask: new Set(),
  deviceTypeTask: new Set(),
};

export function getProviders(): DeviceProviders {
  return providers;
}
