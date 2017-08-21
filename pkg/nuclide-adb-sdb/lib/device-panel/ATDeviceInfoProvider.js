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

import type {DeviceInfoProvider} from '../../../nuclide-device-panel/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Bridge} from '../types';
import type {Device} from '../../../nuclide-device-panel/lib/types';

import {Observable} from 'rxjs';

export class ATDeviceInfoProvider implements DeviceInfoProvider {
  _bridge: Bridge;

  constructor(bridge: Bridge) {
    this._bridge = bridge;
  }

  getType(): string {
    return this._bridge.name;
  }

  fetch(host: NuclideUri, device: Device): Observable<Map<string, string>> {
    return this._bridge
      .getService(host)
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

  getPriority(): number {
    return 100;
  }

  isSupported(): Observable<boolean> {
    return Observable.of(true);
  }
}
