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
import type {Transport} from '../Proxy';
import {Proxy} from '../Proxy';
import {TestTransportFactory} from '../__mocks__/util';
import net from 'net';
import Encoder from '../Encoder';

const TEST_PORT = 4321;

describe('Proxy', () => {
  let testProxy: Proxy;
  let transport: Transport;

  beforeEach(async () => {
    transport = TestTransportFactory();
    testProxy = await Proxy.createProxy(
      'test-tunnel',
      {
        local: {
          port: TEST_PORT,
          useIPv4: false,
        },
        remote: {
          port: 5678,
          useIPv4: false,
        },
      },
      transport,
    );
  });

  afterEach(() => {
    testProxy.close();
  });

  it('sends a connection message on a connection', async () => {
    const socket = net.createConnection({port: TEST_PORT}, async () => {
      const message = (await waitsForMessage(transport, 'connection'))[0];
      expect(message.event).toBe('connection');
      socket.end();
    });
  });

  it('sends data when data is written to the socket', async () => {
    const data = 'hello world';
    const socket = net.createConnection({port: TEST_PORT}, async () => {
      socket.write(data);
      const message = (await waitsForMessage(transport, 'data'))[0];
      expect(message.event).toBe('data');
      const buffer = message.arg;
      expect(buffer.toString()).toBe(data);
    });
  });

  it('sends the end event when the socket is closed', async () => {
    const socket = net.createConnection({port: TEST_PORT}, async () => {
      socket.end();
      const message = (await waitsForMessage(transport, 'end'))[0];
      expect(message.event).toBe('end');
    });
  });

  it('sends the close event when the socket is closed', async () => {
    const socket = net.createConnection({port: TEST_PORT}, async () => {
      socket.end();
      const message = (await waitsForMessage(transport, 'close'))[0];
      expect(message.event).toBe('close');
    });
  });

  it('should differentiate destinations by a clientId', async () => {
    net.createConnection({port: TEST_PORT});
    net.createConnection({port: TEST_PORT});
    const messages = await waitsForMessage(transport, 'connection', 2);
    expect(messages[0].clientId).not.toEqual(messages[1].clientId);
  });

  it('should only write responses to the appropriate client', async () => {});

  it('should close all the sockets when it is closed', async () => {
    net.createConnection({port: TEST_PORT});
    net.createConnection({port: TEST_PORT});
    net.createConnection({port: TEST_PORT});
    const connectionMessages = await waitsForMessage(
      transport,
      'connection',
      3,
    );
    testProxy.close();
    const closeMessages = await waitsForMessage(transport, 'close', 3);
    const connectionIds = connectionMessages.map(message => message.clientId);
    const closeIds = closeMessages.map(message => message.clientId);
    connectionIds.forEach(id => {
      expect(closeIds.includes(id));
    });
  });
});

function waitsForMessage(
  transport: Transport,
  messageType: ?string,
  numberOfMessages: ?number,
): Promise<Array<Object>> {
  const count = numberOfMessages != null ? numberOfMessages : 1;

  return new Promise(resolve => {
    const interval = setInterval(() => {
      const messages = transport.send.mock.calls
        .map(message => Encoder.decode(message))
        .filter(message => message.event === messageType);
      if (messages.length >= count) {
        clearInterval(interval);
        resolve(messages);
      }
    }, 100);
  });
}
