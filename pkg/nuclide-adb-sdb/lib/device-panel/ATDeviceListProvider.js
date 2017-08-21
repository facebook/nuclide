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
  Device,
  DeviceListProvider,
} from '../../../nuclide-device-panel/lib/types';
import type {Expected} from '../../../commons-node/expected';
import type {Bridge} from '../types';

import {Observable} from 'rxjs';

export class ATDeviceListProvider implements DeviceListProvider {
  _bridge: Bridge;

  constructor(bridge: Bridge) {
    this._bridge = bridge;
  }

  getType(): string {
    return this._bridge.name;
  }

  observe(host: NuclideUri): Observable<Expected<Device[]>> {
    return this._bridge.observeDevicesX(host);
  }
}
