/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import typeof * as EchoService from '../__mocks__/EchoService';

import invariant from 'assert';
import net from 'net';
import fs from 'nuclide-commons/fsPromise';
import {SocketServer} from '../lib/SocketServer';
import {SocketTransport} from '../lib/SocketTransport';
import {RpcConnection} from '../lib/RpcConnection';
import loadServicesConfig from '../lib/loadServicesConfig';
import {generateFixture} from 'nuclide-commons/test-helpers';
import {ServiceRegistry} from '../lib/ServiceRegistry';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('SocketServer', () => {
  let configPath: ?string;
  let tempDir: ?string;
  let server: ?SocketServer;

  beforeEach(async () => {
    const services3json = [
      {
        implementation: nuclideUri.join(
          __dirname,
          '../__mocks__/EchoService.js',
        ),
        name: 'EchoService',
      },
    ];
    tempDir = await fs.tempdir();
    const fbservices3json = [];
    configPath = await generateFixture(
      'services',
      new Map([
        ['services-3.json', JSON.stringify(services3json)],
        ['fb-services-3.json', JSON.stringify(fbservices3json)],
      ]),
    );
  });

  afterEach(async () => {
    if (server != null) {
      server.dispose();
      server = null;
    }
    if (tempDir != null) {
      fs.rimraf(tempDir);
      tempDir = null;
    }
  });

  it('connect and send message', async () => {
    invariant(configPath != null);
    invariant(tempDir != null);
    const services = loadServicesConfig(configPath);
    const registry = new ServiceRegistry([localNuclideUriMarshalers], services);
    server = new SocketServer(registry, nuclideUri.join(tempDir, 'socket'));
    const address = await server.getAddress();
    invariant(typeof address === 'string');
    const clientSocket = net.connect({path: address});
    const clientTransport = new SocketTransport(clientSocket);
    const clientConnection = RpcConnection.createLocal(
      clientTransport,
      [localNuclideUriMarshalers],
      services,
    );

    const echoService: EchoService = clientConnection.getService('EchoService');
    const result = await echoService.echoString('Hello World!');

    expect(result).toBe('Hello World!');
  });
});
