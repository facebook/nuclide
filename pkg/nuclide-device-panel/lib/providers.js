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

import type {
  DeviceListProvider,
  DeviceInfoProvider,
  DeviceProcessesProvider,
  DeviceTaskProvider,
  DeviceProcessTaskProvider,
  DeviceTypeTaskProvider,
  DeviceAppInfoProvider,
  DeviceTypeComponentProvider,
} from 'nuclide-debugger-common/types';

type DeviceProviders = {
  deviceList: Set<DeviceListProvider>,
  deviceInfo: Set<DeviceInfoProvider>,
  deviceTask: Set<DeviceTaskProvider>,
  deviceProcesses: Set<DeviceProcessesProvider>,
  processTask: Set<DeviceProcessTaskProvider>,
  deviceTypeTask: Set<DeviceTypeTaskProvider>,
  appInfo: Set<DeviceAppInfoProvider>,
  deviceTypeComponent: Set<DeviceTypeComponentProvider>,
};

const providers: DeviceProviders = {
  deviceList: new Set(),
  deviceInfo: new Set(),
  deviceTask: new Set(),
  deviceProcesses: new Set(),
  processTask: new Set(),
  deviceTypeTask: new Set(),
  deviceAction: new Set(),
  appInfo: new Set(),
  deviceTypeComponent: new Set(),
};

export function getProviders(): DeviceProviders {
  return providers;
}
