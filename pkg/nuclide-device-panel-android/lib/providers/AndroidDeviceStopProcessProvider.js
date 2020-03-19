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

import type {
  Device,
  DeviceProcessTaskProvider,
  Process,
  ProcessTaskType,
} from 'nuclide-debugger-common/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {Observable} from 'rxjs';
import {getAdbServiceByNuclideUri} from 'nuclide-adb/lib/utils';

export class AndroidDeviceStopProcessProvider
  implements DeviceProcessTaskProvider {
  getType(): string {
    return 'Android';
  }

  getTaskType(): ProcessTaskType {
    return 'KILL';
  }

  getName(): string {
    return 'Stop process/package';
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
    return getAdbServiceByNuclideUri(host).stopProcess(
      device.identifier,
      proc.name,
      proc.pid,
    );
  }
}
