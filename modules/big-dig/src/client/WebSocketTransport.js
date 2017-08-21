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

import type WS from 'ws';
import type {Observable} from 'rxjs';

import {Subject} from 'rxjs';
import https from 'https';
import invariant from 'assert';
import {getLogger} from 'log4js';
import {Emitter} from 'event-kit';

const logger = getLogger();

// An unreliable transport for sending JSON formatted messages
// over a WebSocket
//
// onClose handlers are guaranteed to be called exactly once.
// onMessage handlers are guaranteed to not be called after onClose has been called.
// send(data) yields false if the message failed to send, true on success.
// onClose handlers will be called before close() returns.
export class WebSocketTransport {
  id: string;
  _agent: http$Agent;
  _socket: ?WS;
  _emitter: Emitter;
  _messages: Subject<string>;

  constructor(clientId: string, agent: http$Agent, socket: WS) {
    this.id = clientId;
    this._emitter = new Emitter();
    this._agent = agent;
    this._socket = socket;
    this._messages = new Subject();

    logger.info('Client #%s connecting with a new socket!', this.id);
    socket.on('message', (data, flags) => {
      this._onSocketMessage(data);
    });

    socket.on('close', () => {
      if (this._socket != null) {
        invariant(this._socket === socket);
        logger.info(
          'Client #%s socket close recieved on open socket!',
          this.id,
        );
        this._setClosed();
      } else {
        logger.info(
          'Client #%s recieved socket close on already closed socket!',
          this.id,
        );
      }
    });

    socket.on('error', e => {
      if (this._socket != null) {
        logger.error(`Client #${this.id} error: ${e.message}`);
        this._emitter.emit('error', e);
      } else {
        logger.error(`Client #${this.id} error after close: ${e.message}`);
      }
    });

    socket.on('pong', (data, flags) => {
      if (this._socket != null) {
        // data may be a Uint8Array
        this._emitter.emit('pong', data != null ? String(data) : data);
      } else {
        logger.error('Received socket pong after connection closed');
      }
    });
  }

  /** @return `wss://hostname:port`. */
  getAddress(): string {
    const socket = this._socket;
    invariant(socket);
    return socket.url;
  }

  // TODO(mbolin): Remove this once we have BigDigClient working. Until then,
  // this demonstrates how to make a secure request to the HTTPS server.
  testAgent() {
    const {hostname, port} = require('url').parse(this.getAddress());
    // eslint-disable-next-line no-console
    console.log(`will connect to ${String(hostname)} ${String(port)}`);
    const request = https.request(
      {
        hostname,
        port,
        path: '/test',
        method: 'GET',
        agent: this._agent,
      },
      response => {
        // eslint-disable-next-line no-console
        console.log(`received response in testAgent: ${response.statusCode}`);
      },
    );
    request.on('error', e => {
      // eslint-disable-next-line no-console
      console.error(`problem with request: ${e.message}`);
    });
    request.end();
  }

  _onSocketMessage(message: string): void {
    if (this._socket == null) {
      logger.error('Received socket message after connection closed');
      return;
    }
    this._messages.next(message);
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
      const data = message;
      socket.send(data, err => {
        if (err != null) {
          logger.warn(
            'Failed sending socket message to client:',
            this.id,
            message,
          );
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
      this._socket.ping(data);
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
      // In certain (Error) conditions socket.close may not emit the on close
      // event synchronously.
      this._socket = null;
      this._emitter.emit('close');
    }
  }
}
