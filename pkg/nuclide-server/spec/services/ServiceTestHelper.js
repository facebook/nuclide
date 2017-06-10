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

import type {ConfigEntry} from '../../../nuclide-rpc';

import NuclideServer from '../../lib/NuclideServer';
import {NuclideSocket} from '../../lib/NuclideSocket';
import {RpcConnection} from '../../../nuclide-rpc';
import {
  getRemoteNuclideUriMarshalers,
} from '../../../nuclide-marshalers-common';

type Services = Array<ConfigEntry>;

export default class ServiceTestHelper {
  _server: NuclideServer;
  _client: RpcConnection<NuclideSocket>;

  async start(customServices: Services): Promise<void> {
    this._server = new NuclideServer({port: 0}, customServices);
    await this._server.connect();

    const port = this._server._webServer.address().port;
    this._client = RpcConnection.createRemote(
      new NuclideSocket(`http://localhost:${port}`, null),
      [getRemoteNuclideUriMarshalers('localhost')],
      customServices,
    );
  }

  stop(): void {
    this._client.dispose();
    this._server.close();
  }

  getRemoteService(serviceName: string): any {
    return this._client.getService(serviceName);
  }

  getUriOfRemotePath(remotePath: string): string {
    return `nuclide://localhost${remotePath}`;
  }
}
