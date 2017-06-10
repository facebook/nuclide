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

import type {ConfigEntry, Transport} from '../lib/index';

import {LoopbackTransports} from '../lib/LoopbackTransports';
import {RpcConnection} from '../lib/RpcConnection';
import {ServiceRegistry} from '../lib/ServiceRegistry';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import {getRemoteNuclideUriMarshalers} from '../../nuclide-marshalers-common';

export class ServiceTester {
  _serviceRegistry: ServiceRegistry;
  _client: RpcConnection<Transport>;
  _clientConnection: RpcConnection<Transport>;

  async start(
    customServices: Array<ConfigEntry>,
    protocol: string,
  ): Promise<void> {
    const transports = new LoopbackTransports();
    this._serviceRegistry = new ServiceRegistry(
      [localNuclideUriMarshalers],
      customServices,
      protocol,
    );
    this._clientConnection = RpcConnection.createServer(
      this._serviceRegistry,
      transports.serverTransport,
    );

    this._client = RpcConnection.createRemote(
      transports.clientTransport,
      [getRemoteNuclideUriMarshalers('localhost')],
      customServices,
      {},
      protocol,
    );
  }

  stop(): void {
    this._client.dispose();
    this._clientConnection.dispose();
  }

  getRemoteService(serviceName: string): any {
    return this._client.getService(serviceName);
  }

  getUriOfRemotePath(remotePath: string): string {
    return `nuclide://localhost${remotePath}`;
  }
}
