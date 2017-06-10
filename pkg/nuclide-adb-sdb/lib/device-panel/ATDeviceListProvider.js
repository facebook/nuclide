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
  observeAndroidDevicesX,
  observeTizenDevicesX,
} from '../../../nuclide-adb-sdb-base/lib/DevicePoller';
import {Observable} from 'rxjs';

import typeof * as AdbService
  from '../../../nuclide-adb-sdb-rpc/lib/AdbService';
import typeof * as SdbService
  from '../../../nuclide-adb-sdb-rpc/lib/SdbService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  Device,
  DeviceListProvider,
} from '../../../nuclide-devices/lib/types';
import type {Expected} from '../../../nuclide-expected';

export class ATDeviceListProvider implements DeviceListProvider {
  _type: string;
  _rpcFactory: (host: NuclideUri) => AdbService | SdbService;
  _dbAvailable: Map<NuclideUri, Promise<boolean>>;

  constructor(
    type: string,
    rpcFactory: (host: NuclideUri) => AdbService | SdbService,
  ) {
    this._type = type;
    this._rpcFactory = rpcFactory;
    this._dbAvailable = new Map();
  }

  getType(): string {
    return this._type;
  }

  observe(host: NuclideUri): Observable<Expected<Device[]>> {
    if (this._type === 'android') {
      return observeAndroidDevicesX(host);
    } else {
      return observeTizenDevicesX(host);
    }
  }
}
