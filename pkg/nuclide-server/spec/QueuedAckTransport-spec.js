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

import type {UnreliableTransport} from '../../nuclide-rpc';
import {QueuedAckTransport} from '../lib/QueuedAckTransport';
import {Emitter} from 'event-kit';
import {Subject} from 'rxjs';

function makeUnreliableTransport(): UnreliableTransport {
  let isClosed = false;
  const messages: Subject<string> = new Subject();
  const result: any = new Emitter();
  result.send = jasmine.createSpy('send').andCallFake((data: Object) => {
    result.emit('send', data);
    return Promise.resolve(true);
  });
  result.onClose = jasmine
    .createSpy('onClose')
    .andCallFake((callback: () => mixed): IDisposable => {
      return result.on('close', callback);
    });
  result.onMessage = jasmine.createSpy('onMessage').andReturn(messages);
  result.close = jasmine.createSpy('close').andCallFake((): void => {
    isClosed = true;
    result.emit('close');
  });
  result.isClosed = (): boolean => {
    return isClosed;
  };
  result.sendMessage = message => messages.next(message);
  return result;
}

describe('QueuedAckTransport', () => {
  let transport;
  let q;

  beforeEach(() => {
    transport = makeUnreliableTransport();
    q = new QueuedAckTransport('42', transport);
  });

  it('constructor', () => {
    expect(q.getState()).toBe('open');
    expect(transport.onMessage).toHaveBeenCalledWith();
    expect(transport.onClose).toHaveBeenCalledWith(jasmine.any(Function));
  });

  it('send - open', () => {
    const data = JSON.stringify({message: 42});
    q.send(data);
    expect(transport.send).toHaveBeenCalledWith(`>1:${data}`);
  });

  it('close tranport', () => {
    const onDisconnect = jasmine.createSpy('onDisconnect');
    q.onDisconnect(onDisconnect);

    transport.close();

    expect(q.getState()).toBe('disconnected');
    expect(onDisconnect).toHaveBeenCalledWith(transport);
  });

  it('disconnect', () => {
    const onDisconnect = jasmine.createSpy('onDisconnect');
    q.onDisconnect(onDisconnect);

    q.disconnect();

    expect(q.getState()).toBe('disconnected');
    expect(onDisconnect).toHaveBeenCalledWith(transport);
    expect(transport.close).toHaveBeenCalledWith();

    q.disconnect();

    expect(q.getState()).toBe('disconnected');
  });

  it('dispose unsubscribes from disconnect', () => {
    const onDisconnect = jasmine.createSpy('onDisconnect');
    q.onDisconnect(onDisconnect).dispose();

    q.disconnect();

    expect(onDisconnect).not.toHaveBeenCalled();
  });

  it('reconnnect', () => {
    q.disconnect();

    const newTransport = makeUnreliableTransport();
    q.reconnect(newTransport);

    expect(q.getState()).toBe('open');
    expect(newTransport.onMessage).toHaveBeenCalledWith();
    expect(newTransport.onClose).toHaveBeenCalledWith(jasmine.any(Function));
  });

  it('send on reconnect', () => {
    q.disconnect();
    const data = JSON.stringify({message: 42});
    q.send(data);

    const newTransport = makeUnreliableTransport();
    q.reconnect(newTransport);

    expect(q.getState()).toBe('open');
    expect(transport.send).not.toHaveBeenCalled();
    expect(newTransport.send).toHaveBeenCalledWith(`>1:${data}`);
  });

  it('close', () => {
    const onDisconnect = jasmine.createSpy('onDisconnect');
    q.onDisconnect(onDisconnect);
    q.close();

    expect(onDisconnect).toHaveBeenCalledWith(transport);
    expect(q.getState()).toBe('closed');
    expect(transport.close).toHaveBeenCalledWith();
  });

  it('close after disconnect', () => {
    q.disconnect();
    const onDisconnect = jasmine.createSpy('onDisconnect');
    q.onDisconnect(onDisconnect);
    q.close();

    expect(onDisconnect).not.toHaveBeenCalled();
    expect(q.getState()).toBe('closed');
  });

  it('onMessage', () => {
    const onMessage = jasmine.createSpy('onMessage');
    q.onMessage().subscribe(onMessage);
    const data = JSON.stringify({message: 42});
    (transport: any).sendMessage(`>1:${data}`);

    expect(onMessage).toHaveBeenCalledWith(data);
  });

  it('dispose unsubscribes from onMessage', () => {
    const onMessage = jasmine.createSpy('onMessage');
    const subscription = q.onMessage().subscribe(onMessage);
    subscription.unsubscribe();

    const data = JSON.stringify({message: 42});
    (transport: any).sendMessage(`>1:${data}`);

    expect(onMessage).not.toHaveBeenCalled();
  });
});
