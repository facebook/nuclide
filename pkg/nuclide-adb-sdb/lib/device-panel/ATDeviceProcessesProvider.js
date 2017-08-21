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
  Device,
  DeviceProcessesProvider,
  Process,
} from '../../../nuclide-device-panel/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {AndroidBridge} from '../bridges/AndroidBridge';
import {Observable} from 'rxjs';

export class ATDeviceProcessesProvider implements DeviceProcessesProvider {
  _bridge: AndroidBridge;

  constructor(bridge: AndroidBridge) {
    this._bridge = bridge;
  }

  getType(): string {
    return this._bridge.name;
  }

  observe(host: NuclideUri, device: Device): Observable<Process[]> {
    return Observable.interval(3000)
      .startWith(0)
      .switchMap(() =>
        this._bridge
          .getService(host)
          .getProcesses(device)
          .refCount()
          .catch(() => Observable.of([])),
      );
  }
}
