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

import typeof * as AdbService
  from '../../../nuclide-adb-sdb-rpc/lib/AdbService';
import type {
  DeviceProcessesProvider,
  Process,
} from '../../../nuclide-devices/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {Observable} from 'rxjs';

export class ATDeviceProcessesProvider implements DeviceProcessesProvider {
  _type: string;
  _rpcFactory: (host: NuclideUri) => AdbService;

  constructor(type: string, rpcFactory: (host: NuclideUri) => AdbService) {
    this._type = type;
    this._rpcFactory = rpcFactory;
  }

  observe(host: NuclideUri, device: string): Observable<Process[]> {
    return Observable.interval(3000)
      .startWith(0)
      .switchMap(() =>
        this._rpcFactory(host)
          .getProcesses(device)
          .refCount()
          .catch(() => Observable.of([])),
      );
  }

  getType(): string {
    return this._type;
  }
}
