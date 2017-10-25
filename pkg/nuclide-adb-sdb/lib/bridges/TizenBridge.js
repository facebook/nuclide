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
import typeof * as SdbService from '../../../nuclide-adb-sdb-rpc/lib/SdbService';
import type {Store} from '../types';
import type {DebugBridgeFullConfig} from '../../../nuclide-adb-sdb-rpc/lib/types';
import type {Expected} from '../../../commons-node/expected';
import type {Device} from '../../../nuclide-device-panel/lib/types';
import type {DeviceTypeTizen} from '../types';

import * as Actions from '../redux/Actions';
import {getSdbServiceByNuclideUri} from '../../../nuclide-remote-connection';
import {observeTizenDevicesX} from '../../../nuclide-adb-sdb-base/lib/DevicePoller';
import {Observable} from 'rxjs';

export class TizenBridge {
  debugBridge: 'sdb' = 'sdb';
  name: DeviceTypeTizen = 'Tizen';

  _store: Store;

  constructor(store: Store) {
    this._store = store;
  }

  getService(host: NuclideUri): SdbService {
    return getSdbServiceByNuclideUri(host);
  }

  getCustomDebugBridgePath(host: NuclideUri): ?string {
    return this._store.getState().customSdbPaths.get(host);
  }

  setCustomDebugBridgePath(host: NuclideUri, path: ?string): void {
    this._store.dispatch(Actions.setCustomSdbPath(host, path));
  }

  getFullConfig(host: NuclideUri): Promise<DebugBridgeFullConfig> {
    return this.getService(host).getFullConfig();
  }

  observeDevicesX(host: NuclideUri): Observable<Expected<Device[]>> {
    return observeTizenDevicesX(host);
  }
}
