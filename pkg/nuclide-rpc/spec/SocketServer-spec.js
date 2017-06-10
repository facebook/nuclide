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

import typeof * as EchoService from './EchoService';

import invariant from 'assert';
import net from 'net';
import {SocketServer} from '../lib/SocketServer';
import {SocketTransport} from '../lib/SocketTransport';
import {RpcConnection} from '../lib/RpcConnection';
import loadServicesConfig from '../lib/loadServicesConfig';
import {generateFixture} from '../../nuclide-test-helpers';
import {ServiceRegistry} from '../lib/ServiceRegistry';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('SocketServer', () => {
  let configPath: ?string;

  beforeEach(() => {
    waitsForPromise(async () => {
      const services3json = [
        {
          implementation: nuclideUri.join(__dirname, 'EchoService.js'),
          name: 'EchoService',
        },
      ];
      const fbservices3json = [];
      configPath = await generateFixture(
        'services',
        new Map([
          ['services-3.json', JSON.stringify(services3json)],
          ['fb-services-3.json', JSON.stringify(fbservices3json)],
        ]),
      );
    });
  });

  it('connect and send message', () => {
    waitsForPromise(async () => {
      invariant(configPath);
      const services = loadServicesConfig(configPath);
      const registry = new ServiceRegistry(
        [localNuclideUriMarshalers],
        services,
      );
      const server = new SocketServer(registry);
      const address = await server.getAddress();
      invariant(address.port !== 0);

      const clientSocket = net.connect(address.port);
      const clientTransport = new SocketTransport(clientSocket);
      const clientConnection = RpcConnection.createLocal(
        clientTransport,
        [localNuclideUriMarshalers],
        services,
      );

      const echoService: EchoService = clientConnection.getService(
        'EchoService',
      );
      const result = await echoService.echoString('Hello World!');

      expect(result).toBe('Hello World!');

      server.dispose();
    });
  });
});
