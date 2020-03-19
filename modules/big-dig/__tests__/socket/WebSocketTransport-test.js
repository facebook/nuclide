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
import type WS from 'ws';

import EventEmitter from 'events';
import {WebSocketTransport} from '../../src/socket/WebSocketTransport';
import {compress, decompress} from '../../src/socket/compression';

function mockSocket(): WS {
  const result = (new EventEmitter(): any);
  result.close = () => {
    result.emit('close');
  };
  jest.spyOn(result, 'on');
  return result;
}

describe('WebSocketTransport', () => {
  let socket: WS = (null: any);
  let transport: WebSocketTransport = (null: any);

  beforeEach(() => {
    socket = mockSocket();
    transport = new WebSocketTransport('42', socket, {syncCompression: false});
  });

  it('constructor', () => {
    expect(transport.isClosed()).toBe(false);
    expect(socket.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('can receive a message', () => {
    const payload = JSON.stringify({foo: 42});
    let result;
    transport.onMessage().subscribe(message => {
      result = message;
    });
    socket.emit('message', payload, {});
    expect(result).toEqual(payload);
  });

  it('send - success', async () => {
    const s: any = socket;
    s.send = jest.fn((data, _, callback) => callback(null));
    const data = JSON.stringify({foo: 42});
    const result = await transport.send(data);
    expect(result).toBe(true);
    expect(socket.send).toBeCalledWith(
      data,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('send - error', async () => {
    const s: any = socket;
    s.send = jest.fn((data, _, callback) => callback(new Error()));
    const data = JSON.stringify({foo: 42});
    const result = await transport.send(data);
    expect(result).toBe(false);
    expect(socket.send).toBeCalledWith(
      data,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('close event', () => {
    let closed = false;
    transport.onClose(() => {
      // close event should be published exactly once
      expect(closed).toBe(false);
      closed = true;
    });
    socket.emit('close');
    expect(transport.isClosed()).toBe(true);
    expect(closed).toBe(true);

    // This shouldn't throw
    socket.emit('close');
  });

  it('manual close', () => {
    let closed = false;
    transport.onClose(() => {
      // close event should be published exactly once
      expect(closed).toBe(false);
      closed = true;
    });
    transport.close();
    expect(transport.isClosed()).toBe(true);
    expect(closed).toBe(true);

    // This shouldn't throw
    socket.emit('close');
  });

  it('error', () => {
    let error;
    const expected = new Error('error message');
    transport.onError(actual => {
      error = actual;
    });
    socket.emit('error', expected);

    expect(error).toBe(expected);
  });

  it('can send compressed messages', async () => {
    transport = new WebSocketTransport('42', socket, {syncCompression: true});
    const s: any = socket;
    s.send = jest.fn((data, _, callback) => callback(null));
    const data = 'a'.repeat(10000);
    const result = await transport.send(data);
    expect(result).toBe(true);
    expect(s.send).toBeCalled();
    const buffer = s.send.mock.calls[0][0];
    expect(buffer instanceof Buffer).toBe(true);
    expect(decompress(buffer)).toBe(data);
  });

  it('can receive compressed messages', () => {
    const payload = compress('abcd');
    let result;
    transport.onMessage().subscribe(message => {
      result = message;
    });
    socket.emit('message', payload, {binary: true});
    expect(result).toEqual('abcd');
  });
});
