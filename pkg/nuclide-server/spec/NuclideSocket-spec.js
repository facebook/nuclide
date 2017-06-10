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

import type {RpcConnection} from '../../nuclide-rpc';

import NuclideServer from '../lib/NuclideServer';
import servicesConfig from '../lib/servicesConfig';
import {NuclideSocket} from '../lib/NuclideSocket';
import invariant from 'assert';

let server: NuclideServer;
let socket: NuclideSocket;
let serverSocketClient: RpcConnection<any>;

// eslint-disable-next-line jasmine/no-disabled-tests
xdescribe('NuclideSocket test suite', () => {
  beforeEach(() => {
    jasmine.getEnv().defaultTimeoutInterval = 10000;
    waitsForPromise(async () => {
      server = new NuclideServer({port: 8176}, servicesConfig);
      await server.connect();
      socket = new NuclideSocket('http://localhost:8176', null);

      const clientId = Array.from(server._clients.keys())[0];
      const client = server._clients.get(clientId);
      invariant(client != null);
      serverSocketClient = client;
      expect(serverSocketClient.getTransport().id).toBe(clientId);
    });
  });

  afterEach(() => {
    socket.close();
    server.close();
  });

  it('can connect', () => {
    waitsForPromise(() => socket.waitForConnect());
  });

  it('disconnects on close', () => {
    waitsForPromise(async () => {
      await socket.waitForConnect();
      const disconnectHandler: Function = (jasmine.createSpy(): any);
      socket.onDisconnect(disconnectHandler);
      socket.close();
      waitsFor(() => disconnectHandler.callCount > 0);
    });
  });

  describe('xhrRequest()', () => {
    it('gets heartbeat', () => {
      waitsForPromise(async () => {
        const version = await socket.testConnection();
        expect(version).toBeDefined();
      });
    });
  });

  describe('heartbeat()', () => {
    it('checks and emits heartbeat every 5 seconds', () => {
      const heartbeatHandler: Function = (jasmine.createSpy(): any);
      // There was an initial heartbeat, but we can't be sure if it went before or after we do
      // listen here.
      socket.onHeartbeat(heartbeatHandler);
      advanceClock(5050); // Advance the heartbeat interval.
      waitsFor(() => heartbeatHandler.callCount > 0);
      advanceClock(5050); // Advance the heartbeat interval.
      waitsFor(() => heartbeatHandler.callCount > 1);
    });

    it('on ECONNREFUSED, emits PORT_NOT_ACCESSIBLE, when the server was never accessible', () => {
      const heartbeatErrorHandler: Function = (jasmine.createSpy(): any);
      socket.onHeartbeatError(heartbeatErrorHandler);
      // Assume the hearbeat didn't happen.
      socket._heartbeat._heartbeatConnectedOnce = false;
      server.close();
      advanceClock(5050); // Advance the heartbeat interval.
      waitsFor(() => heartbeatErrorHandler.callCount > 0);
      runs(() =>
        expect(heartbeatErrorHandler.argsForCall[0][0].code).toBe(
          'PORT_NOT_ACCESSIBLE',
        ),
      );
    });

    it('on ECONNREFUSED, emits SERVER_CRASHED, when the server was once reachable', () => {
      const heartbeatErrorHandler: Function = (jasmine.createSpy(): any);
      socket.onHeartbeatError(heartbeatErrorHandler);
      socket._heartbeat._heartbeatConnectedOnce = true;
      server.close();
      advanceClock(5050); // Advance the heartbeat interval.
      waitsFor(() => heartbeatErrorHandler.callCount > 0);
      runs(() =>
        expect(heartbeatErrorHandler.argsForCall[0][0].code).toBe(
          'SERVER_CRASHED',
        ),
      );
    });

    it('on ENOTFOUND, emits NETWORK_AWAY error, when the server cannot be located', () => {
      const heartbeatErrorHandler: Function = (jasmine.createSpy(): any);
      socket.onHeartbeatError(heartbeatErrorHandler);
      socket._serverUri = 'http://not.existing.uri.conf:8657';
      advanceClock(5050); // Advance the heartbeat interval.
      waitsFor(() => heartbeatErrorHandler.callCount > 0);
      runs(() =>
        expect(heartbeatErrorHandler.argsForCall[0][0].code).toBe(
          'NETWORK_AWAY',
        ),
      );
    });
  });

  describe('reconnect flow', () => {
    it('the socket would send the cached messages on reconnect', () => {
      const reconnectHandler: Function = (jasmine.createSpy(): any);
      socket.onReconnect(reconnectHandler);
      spyOn(serverSocketClient, '_onSocketMessage');

      const message0 = JSON.stringify({foo0: 'bar0'});
      const message1 = JSON.stringify({foo1: 'bar1'});
      const message2 = JSON.stringify({foo2: 'bar2'});
      const message3 = JSON.stringify({foo3: 'bar3'});
      const message4 = JSON.stringify({foo4: 'bar4'});

      waitsForPromise(() => socket.waitForConnect());
      runs(() => socket.send(message0));
      waitsFor(
        () =>
          serverSocketClient.getTransport()._onSocketMessage.calls.length === 1,
      );

      runs(() => {
        // This call will error, because the socket will be closed on the next statement
        // synchronously.
        socket.send(message1); // The messages will be cached and sent in order.

        socket.send(message2); // The messages will be cached and sent in order.
        // Make sure a close event on the old socket doesn't have any effect on the reconnect
        // with a new socket.
        advanceClock(31 * 1000); // The default WebSocket's close timeout is 30 seconds.
        socket.send(message3); // The messages will be cached and sent in order.
        socket._scheduleReconnect();
        socket.send(message4); // The messages will be cached and sent in order.
        advanceClock(6000); // The maximum reconnect time is 5 seconds.
      });
      waitsFor(() => reconnectHandler.callCount > 0);
      waitsFor(
        () =>
          serverSocketClient.getTransport()._onSocketMessage.calls.length === 5,
      );
      runs(() => {
        expect(
          serverSocketClient.getTransport()._onSocketMessage.calls[0].args[1],
        ).toEqual(message0);
        expect(
          serverSocketClient.getTransport()._onSocketMessage.calls[1].args[1],
        ).toEqual(message1);
        expect(
          serverSocketClient.getTransport()._onSocketMessage.calls[2].args[1],
        ).toEqual(message2);
        expect(
          serverSocketClient.getTransport()._onSocketMessage.calls[3].args[1],
        ).toEqual(message3);
        expect(
          serverSocketClient.getTransport()._onSocketMessage.calls[4].args[1],
        ).toEqual(message4);
      });
    });
  });
});
