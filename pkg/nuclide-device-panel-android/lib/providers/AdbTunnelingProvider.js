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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  DeviceTypeComponentProvider,
  DeviceTypeComponent,
} from 'nuclide-debugger-common/types';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  isAdbTunneled,
  startTunnelingAdb as plainStartTunnelingAdb,
  stopTunnelingAdb,
} from 'nuclide-adb/lib/Tunneling';
import {Observable} from 'rxjs';
import {AdbTunnelButton} from '../ui/AdbTunnelButton';
import * as React from 'react';

let startTunnelingAdb = plainStartTunnelingAdb;
try {
  const {
    fbStartTunnelingAdb,
    // $eslint-disable-next-line $FlowFB
  } = require('nuclide-adb/lib/fb-Tunneling');
  startTunnelingAdb = fbStartTunnelingAdb;
} catch (e) {}

export class AdbTunnelingProvider implements DeviceTypeComponentProvider {
  getType = (): string => {
    return 'Android';
  };

  observe = (
    host: NuclideUri,
    callback: (?DeviceTypeComponent) => void,
  ): IDisposable => {
    const disposable = new UniversalDisposable();
    if (!nuclideUri.isRemote(host)) {
      callback(null);
      return disposable;
    }
    callback({
      position: 'host_selector',
      type: () => {
        const BoundButton = bindObservableAsProps(
          isAdbTunneled(host).map(value => ({
            host,
            status: value ? 'active' : 'inactive',
            enable: () =>
              startTunnelingAdb(host).catch(() => Observable.empty()),
            disable: () => stopTunnelingAdb(host),
          })),
          AdbTunnelButton,
        );
        return <BoundButton />;
      },
      key: 'adb tunneling',
    });
    return disposable;
  };
}
