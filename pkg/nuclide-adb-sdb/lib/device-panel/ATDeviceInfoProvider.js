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

import type {DeviceInfoProvider} from '../../../nuclide-devices/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import typeof * as AdbService
  from '../../../nuclide-adb-sdb-rpc/lib/AdbService';
import typeof * as SdbService
  from '../../../nuclide-adb-sdb-rpc/lib/SdbService';
import {Observable} from 'rxjs';

export class ATDeviceInfoProvider implements DeviceInfoProvider {
  _type: string;
  _rpcFactory: (host: NuclideUri) => AdbService | SdbService;

  constructor(
    type: string,
    rpcFactory: (host: NuclideUri) => AdbService | SdbService,
  ) {
    this._type = type;
    this._rpcFactory = rpcFactory;
  }

  fetch(host: NuclideUri, device: string): Observable<Map<string, string>> {
    return this._rpcFactory(host)
      .getDeviceInfo(device)
      .refCount()
      .map(props => {
        const infoMap = new Map();
        for (const [key, value] of props) {
          const beautifulKey = key.toLowerCase().replace('_', ' ');
          infoMap.set(
            beautifulKey.charAt(0).toUpperCase() + beautifulKey.slice(1),
            value,
          );
        }
        return infoMap;
      });
  }

  getTitle(): string {
    return 'Device information';
  }

  getType(): string {
    return this._type;
  }

  getPriority(): number {
    return 100;
  }

  isSupported(): Observable<boolean> {
    return Observable.of(true);
  }
}
