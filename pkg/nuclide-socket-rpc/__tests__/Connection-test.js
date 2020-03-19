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
import {Connection, ConnectionFactory} from '../lib/Connection';
import net from 'net';
import invariant from 'assert';
import {getLogger} from 'log4js';
import {RemoteSocket} from '../lib/Tunnel';
import waitsFor from '../../../jest/waits_for';

const TEST_PORT = 5004;
const TEST_TUNNEL_HOST = {
  host: 'localhost',
  port: TEST_PORT,
  family: 6,
};

describe.skip('Connection', () => {
  const connectionFactory = new ConnectionFactory();
  let remoteSocket: RemoteSocket;
  let remoteServer;

  beforeEach(async () => {
    getLogger('SocketService-spec').debug('--SPEC START--');
    remoteServer = await createServer(TEST_PORT + 1);
    remoteSocket = await createRemoteSocket(TEST_PORT + 1);
  });

  afterEach(async () => {
    await closeRemoteSocket(remoteSocket, remoteServer.server);
    await closeServer(remoteServer.server);
    getLogger('SocketService-spec').debug('--SPEC END--');
  });

  it('should create a connection to an already listening server', async () => {
    const connectionSpy = jest.fn();
    let localServer;

    const port = TEST_PORT;

    await new Promise(resolve => {
      localServer = net.createServer(connectionSpy);
      localServer.listen({port}, resolve);
    });

    const connection: Connection = await connectionFactory.createConnection(
      TEST_TUNNEL_HOST,
      remoteSocket,
    );

    await waitsFor(() => connectionSpy.mock.calls.length > 0);

    expect(connectionSpy).toHaveBeenCalled();
    connection.dispose();
    await new Promise(r => {
      ((localServer: any): net.Server).close(r);
    });
  });

  it.skip('should write to the remote server when the local server responds', async done => {
    const remoteServerWriteSpy = jest.fn();
    const connectionSpy = jest.fn();
    let localServer: net.Server;

    remoteServer.socket.on('data', remoteServerWriteSpy);

    const port = TEST_PORT;

    await new Promise(resolve => {
      // echo server
      localServer = net.createServer(socket => {
        connectionSpy();
        socket.pipe(socket);
      });
      localServer.listen({port}, resolve);
    });

    const connection: Connection = await connectionFactory.createConnection(
      TEST_TUNNEL_HOST,
      remoteSocket,
    );

    await waitsFor(() => connectionSpy.mock.calls.length > 0);

    expect(connectionSpy).toHaveBeenCalled();
    connection.write(new Buffer('hello world'));

    await waitsFor(() => remoteServerWriteSpy.mock.calls.length > 0);

    expect(remoteServerWriteSpy).toHaveBeenCalled();
    connection.dispose();
    // $FlowFixMe
    localServer.close(done);
  });
});

async function createRemoteSocket(port: number): Promise<RemoteSocket> {
  return new Promise(resolve => {
    const socket = net.createConnection({port, family: 6}, () => {
      resolve(new RemoteSocket(socket));
    });
  });
}

async function closeRemoteSocket(
  remoteSocket: RemoteSocket,
  remoteServer: net.Server,
): Promise<void> {
  remoteSocket.dispose();
  await closeServer(remoteServer);
}

async function createServer(port: number): Promise<Object> {
  const result = {};
  return new Promise(resolve => {
    const server: net.Server = net.createServer(socket => {
      result.socket = socket;
    });

    result.server = server;
    invariant(server);
    server.listen({host: '::', port}, () => {
      resolve(result);
    });
  });
}

async function closeServer(server: net.Server): Promise<void> {
  return new Promise(resolve => {
    server.close(resolve);
  });
}
