/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
declare var jest;

import type {Transport} from '../Proxy';

import {SocketManager} from '../SocketManager';
import {TestTransportFactory} from '../__mocks__/util';

import Encoder from '../Encoder';
import net from 'net';

const TEST_PORT = 5678;
const clientId = 1;

describe('SocketManager', () => {
  let socketManager: SocketManager;
  let transport: Transport;
  let listener: net.Server;
  let dataSpy: (any, any) => void;

  beforeEach(async () => {
    dataSpy = jest.fn();

    return new Promise(resolve => {
      listener = net.createServer(socket => {
        socket.on('data', data => {
          dataSpy(data, socket.remotePort);
          socket.write(data);
        });
      });
      listener.listen({port: TEST_PORT}, resolve);
    });
  });

  afterEach(() => {
    listener.close();
    socketManager.close();
  });

  it('should create a connection when requested', async () => {
    const messages = [{event: 'connection', port: TEST_PORT, clientId}];
    transport = TestTransportFactory();
    socketManager = new SocketManager(
      'tunnel1',
      {port: TEST_PORT, useIPv4: false},
      transport,
    );
    expect(socketManager).not.toBe(undefined);

    sendMessages(socketManager, messages);

    return new Promise(resolve => {
      listener.on('connection', () => {
        listener.getConnections((err, count) => {
          if (err) {
            throw err;
          }
          expect(count).toBe(1);
          resolve();
        });
      });
    });
  });

  it('should correctly write data when a data message comes through', async () => {
    const messages = [
      {event: 'connection', port: TEST_PORT, clientId},
      {event: 'data', TEST_PORT, clientId, arg: 'hello world'},
    ];
    transport = TestTransportFactory();
    socketManager = new SocketManager(
      'tunnel1',
      {port: TEST_PORT, useIPv4: false},
      transport,
    );
    sendMessages(socketManager, messages);

    await waitsForSpy(dataSpy);

    expect(dataSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it('should correctly handle multiple connections', async () => {
    const messages = [
      {event: 'connection', port: TEST_PORT, clientId},
      {event: 'connection', port: TEST_PORT, clientId: clientId + 1},
      {
        event: 'data',
        TEST_PORT,
        clientId,
        arg: '1st connect',
      },
      {
        event: 'data',
        TEST_PORT,
        clientId: clientId + 1,
        arg: '2nd connect',
      },
    ];
    transport = TestTransportFactory();
    socketManager = new SocketManager(
      'tunnel1',
      {port: TEST_PORT, useIPv4: false},
      transport,
    );

    sendMessages(socketManager, messages);

    await waitsForSpy(dataSpy, 2);
    // XXX: the remote ports should be different, this isn't very
    // self-explanatory here, and it's tied to the spy call above
    expect(dataSpy.mock.calls[0][1]).not.toEqual(dataSpy.mock.calls[1][1]);
  });

  it('should send data back when data is written to the socket', async () => {
    const data = 'hello world';

    const messages = [
      {event: 'connection', port: TEST_PORT, clientId},
      {event: 'data', TEST_PORT, clientId, arg: data},
    ];
    transport = TestTransportFactory();
    socketManager = new SocketManager(
      'tunnel1',
      {port: TEST_PORT, useIPv4: false},
      transport,
    );

    sendMessages(socketManager, messages);

    await waitsForSpy(dataSpy);
    await waitsForSpy(transport.send);

    const decodedMessage = Encoder.decode(
      transport.send.mock.calls[0].toString(),
    );
    expect(decodedMessage.arg.toString()).toEqual(data);
  });
});

function waitsForSpy(spy, numberOfCalls: ?number) {
  const count = numberOfCalls != null ? numberOfCalls : 1;
  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (spy.mock.calls.length >= count) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

function sendMessages(socketManager: SocketManager, messages: Array<Object>) {
  messages.forEach(message =>
    setTimeout(() => socketManager.receive(message), 100),
  );
}
