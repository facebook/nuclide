/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import type WS from 'ws';
import type {Observable} from 'rxjs';

import {Subject} from 'rxjs';
import invariant from 'assert';
import {getLogger} from 'log4js';
import {Emitter} from 'event-kit';
import {compress, decompress} from './compression';

const logger = getLogger('reliable-socket');
// Do not synchronously compress large payloads (risks blocking the event loop)
const MAX_SYNC_COMPRESS_LENGTH = 100000;

type Options = {
  // The built-in WebSocket compression implementation can have poor performance characteristics:
  // in particular, decompression takes a full event tick client-side.
  // This option enables our own custom compression format that allows us to use custom
  // decompression client-side.
  syncCompression?: boolean,
};

// An unreliable transport for sending JSON formatted messages
// over a WebSocket
//
// onClose handlers are guaranteed to be called exactly once.
// onMessage handlers are guaranteed to not be called after onClose has been called.
// send(data) yields false if the message failed to send, true on success.
// onClose handlers will be called before close() returns.
export class WebSocketTransport {
  id: string;
  _socket: ?WS;
  _emitter: Emitter;
  _messages: Subject<string>;
  _syncCompression: boolean;

  constructor(clientId: string, socket: WS, options?: Options) {
    this.id = clientId;
    this._emitter = new Emitter();
    this._socket = socket;
    this._messages = new Subject();
    this._syncCompression =
      options == null || options.syncCompression !== false;

    logger.info('Client #%s connecting with a new socket!', this.id);
    socket.on('message', data => {
      let message = data;
      // Only compressed data will be sent as binary buffers.
      if (typeof data !== 'string') {
        message = decompress(data);
      }
      this._messages.next(message);
    });

    socket.on('close', () => {
      invariant(this._socket === socket);
      logger.info('Client #%s socket close received on open socket!', this.id);
      this._setClosed();
    });

    socket.on('error', e => {
      logger.error(`Client #${this.id} error: ${e.message}`);
      this._emitter.emit('error', e);
    });

    socket.on('pong', data => {
      // data may be a Uint8Array
      this._emitter.emit('pong', data != null ? String(data) : data);
    });
  }

  onMessage(): Observable<string> {
    return this._messages;
  }

  onClose(callback: () => mixed): IDisposable {
    return this._emitter.on('close', callback);
  }

  onError(callback: (error: Error) => mixed): IDisposable {
    return this._emitter.on('error', callback);
  }

  send(message: string): Promise<boolean> {
    const socket = this._socket;
    if (socket == null) {
      logger.error(
        'Attempt to send socket message after connection closed',
        new Error(),
      );
      return Promise.resolve(false);
    }

    return new Promise((resolve, reject) => {
      let data = message;
      let compressed = false;
      if (this._syncCompression && message.length < MAX_SYNC_COMPRESS_LENGTH) {
        data = compress(message);
        compressed = true;
      }
      socket.send(data, {compress: !compressed}, err => {
        if (err != null) {
          logger.warn(`Failed sending to client:${this.id} message:${message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // The WS socket automatically responds to pings with pongs.
  ping(data: ?string): void {
    if (this._socket != null) {
      try {
        this._socket.ping(data);
      } catch (e) {
        logger.error('Attempted to ping on the socket and got an error:', e);
      }
    } else {
      logger.error('Attempted to send socket ping after connection closed');
    }
  }

  onPong(callback: (data: ?string) => void): IDisposable {
    return this._emitter.on('pong', callback);
  }

  close(): void {
    if (this._socket != null) {
      // The call to socket.close may or may not cause our handler to be called
      this._socket.close();
      this._setClosed();
    }
  }

  isClosed(): boolean {
    return this._socket == null;
  }

  _setClosed(): void {
    if (this._socket != null) {
      this._socket.removeAllListeners();
      // In certain (Error) conditions socket.close may not emit the on close
      // event synchronously.
      this._socket = null;
      this._emitter.emit('close');
    }
  }
}
