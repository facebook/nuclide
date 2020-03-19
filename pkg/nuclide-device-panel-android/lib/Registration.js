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

import type {DevicePanelServiceApi} from 'nuclide-debugger-common/types';

import {observeAndroidDevices} from 'nuclide-adb';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {AndroidDeviceInfoProvider} from './providers/AndroidDeviceInfoProvider';
import {AndroidDeviceProcessesProvider} from './providers/AndroidDeviceProcessesProvider';
import {AndroidDeviceStopProcessProvider} from './providers/AndroidDeviceStopProcessProvider';
import {AvdComponentProvider} from './providers/AvdComponentProvider';
import {AdbTunnelingProvider} from './providers/AdbTunnelingProvider';

export function registerDevicePanelProviders(
  api: DevicePanelServiceApi,
): IDisposable {
  return new UniversalDisposable(
    api.registerListProvider({
      getType: () => 'Android',
      observe: host =>
        observeAndroidDevices(host).map(expected =>
          expected.map(devices =>
            devices.map(d => ({
              identifier: d.serial,
              displayName: d.displayName,
            })),
          ),
        ),
    }),
    api.registerInfoProvider(new AndroidDeviceInfoProvider()),
    api.registerProcessesProvider(new AndroidDeviceProcessesProvider()),
    api.registerProcessTaskProvider(new AndroidDeviceStopProcessProvider()),
    api.registerDeviceTypeComponentProvider(new AvdComponentProvider()),
    api.registerDeviceTypeComponentProvider(new AdbTunnelingProvider()),
  );
}
