/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {Socket} from 'net';
import type {MessageLogger} from './index';

import {StreamTransport} from './StreamTransport';
import {Emitter} from 'event-kit';
import {Deferred} from 'nuclide-commons/promise';

export class SocketTransport extends StreamTransport {
  _socket: Socket;
  _emitter: Emitter;
  _onConnect: Deferred<void>;

  constructor(
    socket: Socket,
    messageLogger: MessageLogger = (direction, message) => {
      return;
    },
  ) {
    super(socket, socket, messageLogger);
    this._socket = socket;
    this._emitter = new Emitter();

    socket.on('close', () => {
      if (!this.isClosed()) {
        this.close();
      }
      this._emitter.emit('close');
    });

    const connectionDeferred = new Deferred();
    socket.on('connect', connectionDeferred.resolve);
    socket.on('error', error => connectionDeferred.reject(error));
    this._onConnect = connectionDeferred;
  }

  // Returns a promise which resolves on connection or rejects if connection fails.
  onConnected(): Promise<void> {
    return this._onConnect.promise;
  }

  onClose(callback: () => mixed): IDisposable {
    return this._emitter.on('close', callback);
  }

  close(): void {
    super.close();

    // Send the FIN packet ...
    this._socket.end();
    // Then hammer it closed
    this._socket.destroy();

    this._emitter.dispose();
  }
}
