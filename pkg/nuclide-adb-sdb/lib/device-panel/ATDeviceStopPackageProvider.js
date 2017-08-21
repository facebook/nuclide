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
  DeviceProcessTaskProvider,
  Process,
  ProcessTaskType,
} from '../../../nuclide-device-panel/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {AndroidBridge} from '../bridges/AndroidBridge';
import {Observable} from 'rxjs';

export class ATDeviceStopPackageProvider implements DeviceProcessTaskProvider {
  _bridge: AndroidBridge;

  constructor(bridge: AndroidBridge) {
    this._bridge = bridge;
  }

  getType(): string {
    return this._bridge.name;
  }

  getTaskType(): ProcessTaskType {
    return 'KILL';
  }

  getName(): string {
    return 'Stop package';
  }

  isSupported(proc: Process): boolean {
    return true;
  }

  getSupportedPIDs(
    host: NuclideUri,
    device: Device,
    procs: Process[],
  ): Observable<Set<number>> {
    return Observable.of(new Set(procs.map(proc => proc.pid)));
  }

  async run(host: NuclideUri, device: Device, proc: Process): Promise<void> {
    return this._bridge.getService(host).stopPackage(device, proc.name);
  }
}
