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
 */

import type {PipedMessage, ServiceConnection} from './types';

import {getLogger} from 'log4js';
import {DefaultMap} from 'nuclide-commons/collection';
import {Observable, Subject} from 'rxjs';
import * as jsonrpc from 'vscode-jsonrpc';
import {AbstractMessageReader} from 'vscode-jsonrpc/lib/messageReader';
import {AbstractMessageWriter} from 'vscode-jsonrpc/lib/messageWriter';

// We'll represent sockets in pairs (numbers and their negatives).
// After writing to a socket, the message may be read through its negative.
// eslint-disable-next-line
export opaque type Socket = number;

type DataCallback = (data: PipedMessage) => mixed;

/**
 * In the new package model, communication between packages will be modeled as sockets.
 * For each producer <-> consumer pair, we will create a socket:
 * the consumer gets one end of the socket, while the producer gets the other end.
 */
export default class MessageRouter {
  _curSocketID = 1;
  _sockets: Map<Socket, Subject<PipedMessage>> = new Map();

  // If messages are sent to a socket before a listener gets attached,
  // buffer it up here. The buffer will be cleared after the first getMessages call.
  _buffer: DefaultMap<Socket, Array<PipedMessage>> = new DefaultMap(Array);

  /**
   * Returns a pair of sockets.
   */
  getSocket(): [Socket, Socket] {
    const socket = [this._curSocketID, -this._curSocketID];
    this._curSocketID++;
    return socket;
  }

  reverseSocket(socket: Socket): Socket {
    return -socket;
  }

  send(message: PipedMessage): void {
    const {socket} = message;
    const subject = this._sockets.get(socket);
    if (subject == null) {
      this._buffer.get(socket).push(message);
    } else {
      subject.next(message);
    }
  }

  getMessages(socket: Socket): Observable<PipedMessage> {
    let subject = this._sockets.get(socket);
    if (subject == null) {
      subject = new Subject();
      this._sockets.set(socket, subject);
      const buffered = this._buffer.get(socket);
      this._buffer.delete(socket);
      return Observable.from(buffered).concat(subject);
    }
    return subject;
  }

  createConnection(socket: Socket, config: ?Object): ServiceConnection {
    const connection: ServiceConnection = (jsonrpc.createMessageConnection(
      // Messages intended for socket actually come through -socket.
      new SimpleReader(cb =>
        this.getMessages(this.reverseSocket(socket)).subscribe(cb),
      ),
      // Tag each message with the socket it originated from.
      new SimpleWriter(msg => this.send({...msg, socket})),
      getLogger('ExperimentalMessageRouter-jsonrpc'),
    ): any);
    connection.config = config || {};
    connection.listen();
    return connection;
  }
}

class SimpleReader extends AbstractMessageReader {
  _subscribe: (callback: DataCallback) => mixed;

  constructor(subscribe: (callback: DataCallback) => mixed): void {
    super();
    this._subscribe = subscribe;
  }

  listen(callback: (data: PipedMessage) => mixed): void {
    this._subscribe(callback);
  }
}

class SimpleWriter extends AbstractMessageWriter {
  _write: (message: PipedMessage) => mixed;

  constructor(write: (message: PipedMessage) => mixed) {
    super();
    this._write = write;
  }

  write(message: PipedMessage): void {
    this._write(message);
  }
}
