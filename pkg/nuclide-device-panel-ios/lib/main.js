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

import type {
  DeviceArchitecture,
  DevicePanelServiceApi,
} from '../../nuclide-device-panel/lib/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Expect} from '../../commons-node/expected';
import {getDevices} from '../../nuclide-fbsimctl';

class Activation {
  _disposables = new UniversalDisposable();
  _type = 'iOS';

  consumeDevicePanelServiceApi(api: DevicePanelServiceApi): void {
    this._disposables.add(this.registerDeviceList(api));
  }

  registerDeviceList(api: DevicePanelServiceApi): IDisposable {
    return api.registerListProvider({
      observe: host => {
        if (nuclideUri.isRemote(host)) {
          return Observable.of(
            Expect.error(
              new Error(
                'iOS devices on remote hosts are not currently supported.',
              ),
            ),
          );
        } else {
          return getDevices().map(devices => {
            if (devices instanceof Error) {
              return Expect.error(devices);
            } else {
              return Expect.value(
                devices.map(device => ({
                  name: device.udid,
                  port: 0,
                  displayName: device.name,
                  architecture: devicePanelArchitecture(device.arch),
                  rawArchitecture: device.arch,
                  ignoresSelection: true,
                })),
              );
            }
          });
        }
      },
      getType: () => this._type,
    });
  }
}

function devicePanelArchitecture(arch: string): DeviceArchitecture {
  switch (arch) {
    case 'x86_64':
      return 'x86_64';
    case 'i386':
      return 'x86';
    case 'arm64':
      return 'arm64';
    case 'armv7':
    case 'armv7s':
      return 'arm';
    default:
      return '';
  }
}

createPackage(module.exports, Activation);
