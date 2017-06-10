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

import WS from 'ws';
import NuclideServer from '../lib/NuclideServer';
import {RpcConnection} from '../../nuclide-rpc';
import servicesConfig from '../lib/servicesConfig';

import invariant from 'assert';
import {NuclideSocket} from '../lib/NuclideSocket';
import {getRemoteNuclideUriMarshalers} from '../../nuclide-marshalers-common';

let server;
let client;
let socket;

describe('Nuclide Server test suite', () => {
  beforeEach(() => {
    jasmine.getEnv().defaultTimeoutInterval = 10000;

    waitsForPromise(async () => {
      server = new NuclideServer({port: 8176}, servicesConfig);
      await server.connect();
      socket = new NuclideSocket('http://localhost:8176', null);
      client = RpcConnection.createRemote(
        socket,
        [getRemoteNuclideUriMarshalers('localhost')],
        servicesConfig,
      );
    });
  });

  afterEach(() => {
    client.dispose();
    server.close();
  });

  it('websocket is connected with the server', () => {
    const websocket = new WS('ws://localhost:8176');
    let opened = false;
    websocket.once('open', () => {
      opened = true;
    });
    waitsFor(() => opened);
  });

  // eslint-disable-next-line jasmine/no-disabled-tests
  xdescribe('reconnect websocket flow', () => {
    it('server sent messages, while disconnected will still be delievered', () => {
      // Here is the initial message.
      const nuclideSocket = socket;
      const messageHandler: Function = (jasmine.createSpy(): any);
      const reconnectHandler: Function = (jasmine.createSpy(): any);
      nuclideSocket.onReconnect(reconnectHandler);
      nuclideSocket.onMessage().subscribe(messageHandler);
      // The maximum reconnect time is 5 seconds - advance clock to sip the reconnect time.
      nuclideSocket.onDisconnect(() =>
        process.nextTick(() => advanceClock(6000)),
      );

      waitsForPromise(() => nuclideSocket.waitForConnect());

      const message1 = JSON.stringify({foo1: 'bar1'});
      const message2 = JSON.stringify({foo2: 'bar2'});
      const message3 = JSON.stringify({foo3: 'bar3'});
      const message4 = JSON.stringify({foo4: 'bar4'});

      // Wait for the connection to exist on the server.
      waitsFor(() => server._clients.size === 1);

      let serverSocketClient = null;
      runs(() => {
        const clientId = Array.from(server._clients.keys())[0];
        serverSocketClient = server._clients.get(clientId);
        invariant(serverSocketClient != null);
        expect(serverSocketClient.getTransport().id).toBe(clientId);

        serverSocketClient.getTransport().send(message1);
      });

      waitsFor(() => messageHandler.callCount === 1);
      runs(() => {
        // Close the client socket and start a reconnect trial, send a message in between.
        // A server socket close will trigger a client disconnect and a scheduled reconnect.
        if (serverSocketClient != null && serverSocketClient.socket != null) {
          // $FlowIgnore: This test has bitrotted
          serverSocketClient.socket.close();
          serverSocketClient.getTransport().send(message2);
          // The default WebSocket's close timeout is 30 seconds.
          advanceClock(31 * 1000);
          serverSocketClient.getTransport().send(message3);
        }
      });

      waitsFor(() => reconnectHandler.callCount === 1);
      runs(() => {
        if (serverSocketClient != null) {
          serverSocketClient.getTransport().send(message4);
        }
      });

      waitsFor(() => messageHandler.callCount === 4);
      runs(() => {
        // Received on the first stable websocket connection.
        expect(messageHandler.argsForCall[0][0]).toEqual(message1);
        // Cached in the queue when disconnected.
        expect(messageHandler.argsForCall[1][0]).toEqual(message2);
        // Cached in the queue when disconnected.
        expect(messageHandler.argsForCall[2][0]).toEqual(message3);
        // Received on the reconnected stable websocket connection.
        expect(messageHandler.argsForCall[3][0]).toEqual(message4);
      });
    });
  });
});
