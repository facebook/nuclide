/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import fs from 'fs';

import nuclideUri from 'nuclide-commons/nuclideUri';
import NuclideServer from '../lib/NuclideServer';
import {RpcConnection} from '../../nuclide-rpc';
import servicesConfig from '../lib/servicesConfig';
import {ReliableSocket} from 'big-dig/src/socket/ReliableSocket';
import {WebSocketTransport} from 'big-dig/src/socket/WebSocketTransport';
import {getRemoteNuclideUriMarshalers} from '../../nuclide-marshalers-common';
import {getVersion} from '../../nuclide-version';
import invariant from 'assert';
import child_process from 'child_process';
import nullthrows from 'nullthrows';

jest.setTimeout(30000);

const HEARTBEAT_CHANNEL = 'test-heartbeat';

let server;
let socket;

// Paths to certificate authority crt (certificate)
let ca_cert_path;

// Path to server key, and crt (certificate)
let server_cert_path;
let server_key_path;

// Path to client key, and crt (certificate)
let client_cert_path;
let client_key_path;

const gen_certs_path = nuclideUri.resolve(
  __dirname,
  '../scripts/nuclide_certificates_generator.py',
);

describe('Nuclide Secure Server test suite', () => {
  it.skip('Starts a server', async () => {
    // generating certificates step fails because of missing `propmt = no` in
    // the config.
    generateCertificates();

    server = new NuclideServer(
      {
        port: 8176,
        serverKey: fs.readFileSync(server_key_path),
        serverCertificate: fs.readFileSync(server_cert_path),
        certificateAuthorityCertificate: fs.readFileSync(ca_cert_path),
      },
      servicesConfig,
    );

    await server.connect();

    socket = new ReliableSocket('https://localhost:8176', HEARTBEAT_CHANNEL, {
      ca: fs.readFileSync(ca_cert_path),
      cert: fs.readFileSync(client_cert_path),
      key: fs.readFileSync(client_key_path),
      family: 6,
    });
    const client = RpcConnection.createRemote(
      socket,
      [getRemoteNuclideUriMarshalers('localhost')],
      servicesConfig,
    );
    invariant(client);

    const version = await client.getService('InfoService').getServerVersion();
    expect(version).toBe(getVersion());

    // Ensure that we resolved the IPv6 address.
    const rpcTransport = client._transport;
    const queuedTransport = nullthrows(rpcTransport)._transport;
    const webSocketTransport = (nullthrows(queuedTransport): any)._transport;
    invariant(webSocketTransport instanceof WebSocketTransport);
    const webSocket = nullthrows(webSocketTransport._socket);
    expect(webSocket._socket.remoteAddress).toBe('::1');

    socket.close();
    server.close();
  });
});

function generateCertificates() {
  const out = child_process
    .execSync(`${gen_certs_path} -s localhost`)
    .toString('utf8');
  const json = JSON.parse(out);
  ca_cert_path = json.ca_cert;
  server_cert_path = json.server_cert;
  server_key_path = json.server_key;
  client_cert_path = json.client_cert;
  client_key_path = json.client_key;
}
