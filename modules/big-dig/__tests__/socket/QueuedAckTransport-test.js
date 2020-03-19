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
import type {WebSocketTransport} from '../../src/socket/WebSocketTransport';
import invariant from 'assert';
import {
  QueuedAckTransport,
  frameAck,
  frameContent,
  parseMessage,
  ACK,
  CONTENT,
  ACK_BUFFER_TIME,
  PENDING_MESSAGE_TIMEOUT,
} from '../../src/socket/QueuedAckTransport';
import {Emitter} from 'event-kit';
import {Subject} from 'rxjs';

function makeUnreliableTransport(
  receiver: Subject<string> = new Subject(),
): WebSocketTransport {
  let isClosed = false;
  const transport: any = new Emitter();
  transport.send = jest.fn((data: Object) => {
    transport.emit('send', data);
    return Promise.resolve(true);
  });
  transport.onClose = jest.fn(
    (callback: () => mixed): IDisposable => {
      return transport.on('close', callback);
    },
  );
  transport.onMessage = jest.fn(() => receiver);
  transport.close = jest.fn(
    (): void => {
      isClosed = true;
      transport.emit('close');
    },
  );
  transport.isClosed = (): boolean => {
    return isClosed;
  };
  return transport;
}

jest.useFakeTimers();

function advanceClock(duration: number) {
  jest.advanceTimersByTime(duration);
}

describe('QueuedAckTransport framing', () => {
  it('roundtrips ack id', () => {
    const wireMessage = frameAck(53);
    const parsed = parseMessage(wireMessage);
    expect(parsed.type).toBe(ACK);
    expect(parsed.id).toBe(53);
  });
  it('roundtrips content', () => {
    const id = 65536;
    const message = 'May I ask you a question?';
    const wireMessage = frameContent(id, message);
    const parsed = parseMessage(wireMessage);
    expect(parsed.type).toBe(CONTENT);
    invariant(parsed.type === 'CONTENT');
    expect(parsed.id).toBe(id);
    expect(parsed.message).toBe(message);
  });
});

describe('QueuedAckTransport', () => {
  let receiver: Subject<string>;
  let transport;
  let q;

  beforeEach(() => {
    receiver = new Subject();
    transport = makeUnreliableTransport(receiver);
    q = new QueuedAckTransport('42', transport);
  });

  it('constructor', () => {
    expect(q.getState()).toBe('open');
    expect(transport.onMessage).toBeCalledWith();
    expect(transport.onClose).toBeCalledWith(expect.any(Function));
  });

  it('send - open', () => {
    const data = JSON.stringify({message: 42});
    q.send(data);
    expect(transport.send).toBeCalledWith(frameContent(1, data));
  });

  it('close tranport', () => {
    const onDisconnect = jest.fn();
    q.onDisconnect(onDisconnect);

    transport.close();

    expect(q.getState()).toBe('disconnected');
    expect(onDisconnect).toBeCalledWith(transport);
  });

  it('disconnect', () => {
    const onDisconnect = jest.fn();
    q.onDisconnect(onDisconnect);

    q.disconnect();

    expect(q.getState()).toBe('disconnected');
    expect(onDisconnect).toBeCalledWith(transport);
    expect(transport.close).toBeCalledWith();

    q.disconnect();

    expect(q.getState()).toBe('disconnected');
  });

  it('dispose unsubscribes from disconnect', () => {
    const onDisconnect = jest.fn();
    q.onDisconnect(onDisconnect).dispose();

    q.disconnect();

    expect(onDisconnect).not.toBeCalled();
  });

  it('reconnnect', () => {
    q.disconnect();

    const newTransport = makeUnreliableTransport();
    q.reconnect(newTransport);

    expect(q.getState()).toBe('open');
    expect(newTransport.onMessage).toBeCalledWith();
    expect(newTransport.onClose).toBeCalledWith(expect.any(Function));
  });

  it('send while disconnected resends on reconnect', () => {
    q.disconnect();
    const data = JSON.stringify({message: 42});
    q.send(data);

    const newTransport = makeUnreliableTransport();
    q.reconnect(newTransport);

    expect(q.getState()).toBe('open');
    expect(transport.send).not.toBeCalled();
    expect(newTransport.send).toBeCalledWith(frameContent(1, data));
  });

  it('resend only unacked on reconnect', () => {
    const data1 = JSON.stringify({message: 42});
    const data2 = JSON.stringify({message: 97});
    q.send(data1);
    q.send(data2);
    receiver.next(frameAck(1));
    q.disconnect();

    const newTransport = makeUnreliableTransport(receiver);
    q.reconnect(newTransport);

    expect(q.getState()).toBe('open');
    expect(transport.send).toBeCalled();
    expect(transport.send.mock.calls).toEqual([
      [frameContent(1, data1)],
      [frameContent(2, data2)],
    ]);
    expect(newTransport.send).toBeCalled();
    expect(newTransport.send.mock.calls).toEqual([[frameContent(2, data2)]]);
  });

  it('close', () => {
    const onDisconnect = jest.fn();
    q.onDisconnect(onDisconnect);
    q.close();

    expect(onDisconnect).toBeCalledWith(transport);
    expect(q.getState()).toBe('closed');
    expect(transport.close).toBeCalledWith();
  });

  it('close after disconnect', () => {
    q.disconnect();
    const onDisconnect = jest.fn();
    q.onDisconnect(onDisconnect);
    q.close();

    expect(onDisconnect).not.toBeCalled();
    expect(q.getState()).toBe('closed');
  });

  it('onMessage', () => {
    const onMessage = jest.fn();
    q.onMessage().subscribe(onMessage);
    const data = JSON.stringify({message: 42});
    receiver.next(frameContent(1, data));

    expect(onMessage).toBeCalledWith(data);
  });

  // This simulates receiving the first two messages out of order.
  // The receiver should process 1,2.
  it('onMessage first two out of order', () => {
    const onMessage = jest.fn();
    q.onMessage().subscribe(onMessage);
    const data1 = JSON.stringify({message: 42});
    const data2 = JSON.stringify({message: 43});

    receiver.next(frameContent(2, data2));
    receiver.next(frameContent(1, data1));

    expect(onMessage.mock.calls).toEqual([[data1], [data2]]);
  });

  // This simulates a sender retrying messages and sending a,a,b,b (where a+1=b),
  // where the middle two messages are reordered so the receiver sees a,b,a,b.
  // The receiver should still process only a,b
  it('onMessage retry out of order', () => {
    const onMessage = jest.fn();
    q.onMessage().subscribe(onMessage);
    const data1 = JSON.stringify({message: 42});
    const data2 = JSON.stringify({message: 43});

    receiver.next(frameContent(1, data1));
    receiver.next(frameContent(2, data2));
    receiver.next(frameContent(1, data1));
    receiver.next(frameContent(2, data2));

    expect(onMessage).toBeCalled();
    expect(onMessage.mock.calls).toEqual([[data1], [data2]]);
  });

  it('dispose unsubscribes from onMessage', () => {
    const onMessage = jest.fn();
    const subscription = q.onMessage().subscribe(onMessage);
    subscription.unsubscribe();

    const data = JSON.stringify({message: 42});
    receiver.next(frameContent(1, data));

    expect(onMessage).not.toBeCalled();
  });

  it('disconnects if pending send sits too long', () => {
    const data = JSON.stringify({message: 42});
    q.send(data);

    advanceClock(PENDING_MESSAGE_TIMEOUT - 1);
    expect(transport.close).not.toBeCalled();
    expect(q.getState()).toBe('open');

    advanceClock(2);
    expect(transport.close).toBeCalled();
    expect(q.getState()).toBe('disconnected');
  });

  it('disconnects if pending receive sits too long', () => {
    const onMessage = jest.fn();
    q.onMessage().subscribe(onMessage);
    const data = JSON.stringify({message: 42});
    receiver.next(frameContent(2, data));

    advanceClock(PENDING_MESSAGE_TIMEOUT - 1);
    expect(transport.close).not.toBeCalled();
    expect(q.getState()).toBe('open');

    advanceClock(2);
    expect(transport.close).toBeCalled();
    expect(q.getState()).toBe('disconnected');

    expect(onMessage).not.toBeCalled();
  });

  it('does not disconnect if no pending work', () => {
    const data = JSON.stringify({message: 42});
    q.send(data);
    receiver.next(frameAck(1));

    advanceClock(2 * PENDING_MESSAGE_TIMEOUT);
    expect(transport.close).not.toBeCalled();
    expect(q.getState()).toBe('open');
  });

  it('does not disconnect if we keep making progress', () => {
    const data1 = JSON.stringify({message: 42});
    const data2 = JSON.stringify({message: 97});
    const expectedSends = [];
    const expectedDeliveries = [];
    const onMessage = jest.fn();
    q.onMessage().subscribe(onMessage);

    function check() {
      expect(q.getState()).toBe('open');
      expect(transport.close).not.toBeCalled();
      expect(transport.send.mock.calls).toEqual(expectedSends);
      expect(onMessage.mock.calls).toEqual(expectedDeliveries);
    }

    q.send(data1);
    expectedSends.push([frameContent(1, data1)]);
    check(); // q.send(data1)

    advanceClock(PENDING_MESSAGE_TIMEOUT - 1);
    check(); // advanceClock after q.send(data1)

    receiver.next(frameContent(2, data2));
    check(); // receiver.next(frameContent(2, data2))

    receiver.next(frameAck(1));
    check(); // receiver.next(frameAck(1))

    advanceClock(PENDING_MESSAGE_TIMEOUT - 1);
    check(); // advanceClock after receiver.next(frameAck(1))

    q.send(data2);
    expectedSends.push([frameContent(2, data2)]);
    check(); // q.send(data2)

    receiver.next(frameContent(1, data1));
    expectedDeliveries.push([data1]);
    expectedDeliveries.push([data2]);
    check(); // receiver.next(frameContent(1, data1))

    advanceClock(PENDING_MESSAGE_TIMEOUT - 1);
    // Assuming ACK_BUFFER_TIME has passed, now that we received 2 and then 1,
    // we should have sent an ack for 2.
    invariant(PENDING_MESSAGE_TIMEOUT - 1 > ACK_BUFFER_TIME);
    expectedSends.push([frameAck(2)]);
    check(); // advanceClock after receiver.next(frameContent(1, data1))

    receiver.next(frameAck(2));
    check(); // receiver.next(frameAck(2))

    advanceClock(2 * PENDING_MESSAGE_TIMEOUT);
    check(); // advanceClock final
  });

  it('does not crash with amnesia', () => {
    receiver.next(frameAck(10));
    expect(q.getState()).toBe('closed');
    expect(transport.close).toBeCalled();
  });
});
