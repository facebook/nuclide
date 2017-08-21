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

import type {DevicePanelServiceApi} from '../../../nuclide-device-panel/lib/types';

import {AndroidBridge} from '../bridges/AndroidBridge';
import {TizenBridge} from '../bridges/TizenBridge';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ATDeviceListProvider} from './ATDeviceListProvider';
import {ATDeviceInfoProvider} from './ATDeviceInfoProvider';
import {ATDeviceProcessesProvider} from './ATDeviceProcessesProvider';
import {ATDeviceStopPackageProvider} from './ATDeviceStopPackageProvider';
import {ATConfigurePathTaskProvider} from './ATConfigurePathTaskProvider';

export function registerDevicePanelProviders(
  api: DevicePanelServiceApi,
  android: AndroidBridge,
  tizen: TizenBridge,
): IDisposable {
  return new UniversalDisposable(
    // list
    api.registerListProvider(new ATDeviceListProvider(android)),
    api.registerListProvider(new ATDeviceListProvider(tizen)),
    // info
    api.registerInfoProvider(new ATDeviceInfoProvider(android)),
    api.registerInfoProvider(new ATDeviceInfoProvider(tizen)),
    // processes
    api.registerProcessesProvider(new ATDeviceProcessesProvider(android)),
    // process tasks
    api.registerProcessTaskProvider(new ATDeviceStopPackageProvider(android)),
    // device type tasks
    api.registerDeviceTypeTaskProvider(
      new ATConfigurePathTaskProvider(android),
    ),
    api.registerDeviceTypeTaskProvider(new ATConfigurePathTaskProvider(tizen)),
  );
}
