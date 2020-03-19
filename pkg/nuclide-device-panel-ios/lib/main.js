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

import type {DevicePanelServiceApi} from 'nuclide-debugger-common/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import passesGK from 'nuclide-commons/passesGK';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';
import {observeIosDevices} from '../../nuclide-fbsimctl';
import {startTunnelingIdb} from '../../nuclide-fbsimctl/lib/Tunneling';
import {ServerConnection} from '../../nuclide-remote-connection';
import {IdbTunnelingProvider} from './IdbTunnelingProvider';

class Activation {
  _disposables = new UniversalDisposable();
  _type = 'iOS';

  consumeDevicePanelServiceApi(api: DevicePanelServiceApi): void {
    this._disposables.add(this.registerDeviceList(api));
    this._disposables.add(
      new UniversalDisposable(
        ServerConnection.onDidAddServerConnection(async connection => {
          if (!(await passesGK('nuclide_idb_tunneling_devservers'))) {
            return;
          }
          const hostname = connection.getRemoteHostname();
          if (
            !hostname.startsWith('dev') &&
            !hostname.endsWith('.sb.facebook.com')
          ) {
            return;
          }
          startTunnelingIdb(connection.getUriOfRemotePath('/')).catch(() =>
            Observable.empty(),
          );
        }),
      ),
    );
  }

  registerDeviceList(api: DevicePanelServiceApi): IDisposable {
    return new UniversalDisposable(
      api.registerListProvider({
        observe: host => {
          return observeIosDevices(host).map(expected =>
            expected.map(devices =>
              devices.map(device => ({
                identifier: device.udid,
                displayName: device.name,
                ignoresSelection: true,
              })),
            ),
          );
        },
        getType: () => this._type,
      }),
      api.registerDeviceTypeComponentProvider(new IdbTunnelingProvider()),
    );
  }
}

createPackage(module.exports, Activation);
