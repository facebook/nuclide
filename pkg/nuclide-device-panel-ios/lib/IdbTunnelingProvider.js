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
  isIdbTunneled,
  startTunnelingIdb,
  stopTunnelingIdb,
} from '../../nuclide-fbsimctl/lib/Tunneling';
import {Observable} from 'rxjs';
import {IdbTunnelButton} from '../ui/IdbTunnelButton';
import * as React from 'react';

export class IdbTunnelingProvider implements DeviceTypeComponentProvider {
  getType = (): string => {
    return 'iOS';
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
          isIdbTunneled(host).map(value => ({
            host,
            status: value ? 'active' : 'inactive',
            enable: () =>
              startTunnelingIdb(host).catch(() => Observable.empty()),
            disable: () => stopTunnelingIdb(host),
          })),
          IdbTunnelButton,
        );
        return <BoundButton />;
      },
      key: 'idb tunneling',
    });
    return disposable;
  };
}
