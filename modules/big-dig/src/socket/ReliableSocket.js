/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {AgentOptions} from '../common/types';
import type {ProtocolLogger} from './QueuedAckTransport';

import {Observable} from 'rxjs';
import url from 'url';
import WS from 'ws';
import uuid from 'uuid';
import {Emitter} from 'event-kit';
import {WebSocketTransport} from './WebSocketTransport';
import {QueuedAckTransport} from './QueuedAckTransport';
import {XhrConnectionHeartbeat} from '../client/XhrConnectionHeartbeat';
import invariant from 'assert';
import {getLogger} from 'log4js';

const logger = getLogger('reliable-socket');

const PING_SEND_INTERVAL = 5000;
const PING_WAIT_INTERVAL = 5000;

const INITIAL_RECONNECT_TIME_MS = 10;
const MAX_RECONNECT_TIME_MS = 5000;

// The ReliableSocket class does several things:
//   - Provides a transport mechanism for sending/receiving JSON messages
//   - Provides a transport layer for xhr requests
//   - monitors connection with a heartbeat (over xhr) and automatically attempts to reconnect
//   - caches JSON messages when the connection is down and retries on reconnect
//
// Can be in one of the following states:
//   - Connected - everything healthy
//   - Disconnected - Was connected, but connection died. Will attempt to reconnect.
//   - Closed - No longer connected. May not send/receive messages. Cannot be resurrected.
//
// Publishes the following events:
//   - status(boolean): on connect/disconnect
//   - connect: on first Connection
//   - reconnect: on reestablishing connection after a disconnect
//   - message(message: Object): on receipt fo JSON message
//   - heartbeat: On receipt of successful heartbeat
//   - heartbeat.error({code, originalCode, message}): On failure of heartbeat
//   - intransient-error: the server is reachable but refusing to respond to
//     connections (i.e. ECONNREFUSED).
//   - close: this socket has been closed by a call to `close()`.
export class ReliableSocket {
  id: string;

  _serverUri: string;
  _options: ?AgentOptions;
  _pingTimer: ?TimeoutID;
  _reconnectTime: number;
  _reconnectTimer: ?TimeoutID; // ID from a setTimeout() call.
  _previouslyConnected: boolean;
  _websocketUri: string;
  _emitter: Emitter;
  _transport: ?QueuedAckTransport;
  _heartbeat: XhrConnectionHeartbeat;
  _heartbeatChannel: string;

  constructor(
    serverUri: string,
    heartbeatChannel: string,
    options: ?AgentOptions,
    protocolLogger: ?ProtocolLogger,
  ) {
    this._emitter = new Emitter();
    this._serverUri = serverUri;
    this._options = options;
    this._heartbeatChannel = heartbeatChannel;
    this.id = uuid.v4();
    this._pingTimer = null;
    this._reconnectTime = INITIAL_RECONNECT_TIME_MS;
    this._reconnectTimer = null;
    this._previouslyConnected = false;
    this._transport = new QueuedAckTransport(this.id, null, protocolLogger);

    this._transport.onDisconnect(() => {
      if (this.isDisconnected()) {
        this._emitter.emit('status', false);
        this._emitter.emit('disconnect');
        this._scheduleReconnect();
      }
    });

    const {protocol, host, path} = url.parse(serverUri);
    invariant(host != null);
    const pathString = path != null ? path : '';
    this._websocketUri = `ws${
      protocol === 'https:' ? 's' : ''
    }://${host}${pathString}`;

    logger.info(`websocket uri: ${this._websocketUri}`);

    this._heartbeat = new XhrConnectionHeartbeat(
      serverUri,
      this._heartbeatChannel,
      options,
    );
    this._heartbeat.onConnectionRestored(() => {
      if (this.isDisconnected()) {
        this._scheduleReconnect();
      }
    });

    this._reconnect();
  }

  getHeartbeat(): XhrConnectionHeartbeat {
    return this._heartbeat;
  }

  isConnected(): boolean {
    return this._transport != null && this._transport.getState() === 'open';
  }

  isDisconnected(): boolean {
    return (
      this._transport != null && this._transport.getState() === 'disconnected'
    );
  }

  waitForConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected()) {
        return resolve();
      } else {
        this.onConnect(resolve);
        this.onReconnect(resolve);
      }
    });
  }

  _reconnect() {
    invariant(this.isDisconnected());

    const websocket = new WS(this._websocketUri, {
      ...this._options,
      headers: {
        client_id: this.id,
      },
    });

    // Need to add this otherwise unhandled errors during startup will result
    // in uncaught exceptions. This is due to EventEmitter treating 'error'
    // events specially.
    const onSocketError = error => {
      logger.warn(`WebSocket Error while connecting... ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        // Error: "Connection Refused"
        // The remote machine is reachable, but the server is not running.
        // Listeners may choose to close this socket.
        this._emitter.emit('intransient-error', error);
      }
      if (this.isDisconnected()) {
        logger.info('WebSocket reconnecting after error.');
        this._scheduleReconnect();
      }
    };
    websocket.on('error', onSocketError);

    const onSocketOpen = async () => {
      if (this.isDisconnected()) {
        const ws = new WebSocketTransport(this.id, websocket);
        const pingId = uuid.v4();
        ws.onClose(() => {
          this._clearPingTimer();
        });
        ws.onError(error => {
          ws.close();
        });
        ws.onPong(data => {
          if (pingId === data) {
            this._schedulePing(pingId, ws);
          } else {
            logger.error('pingId mismatch');
          }
        });
        // eslint-disable-next-line nuclide-internal/unused-subscription
        ws.onMessage().subscribe(() => {
          this._schedulePing(pingId, ws);
        });
        this._schedulePing(pingId, ws);
        invariant(this._transport != null);
        this._transport.reconnect(ws);
        websocket.removeListener('error', onSocketError);
        this._emitter.emit('status', true);
        if (this._previouslyConnected) {
          logger.info('WebSocket reconnected');
          this._emitter.emit('reconnect');
        } else {
          logger.info('WebSocket connected');
          this._emitter.emit('connect');
        }
        this._previouslyConnected = true;
        this._reconnectTime = INITIAL_RECONNECT_TIME_MS;
      }
    };
    websocket.on('open', onSocketOpen);
  }

  _schedulePing(data: string, ws: WebSocketTransport): void {
    this._clearPingTimer();
    this._pingTimer = setTimeout(() => {
      ws.ping(data);
      this._pingTimer = setTimeout(() => {
        logger.warn('Failed to receive pong in response to ping');
        ws.close();
      }, PING_WAIT_INTERVAL);
    }, PING_SEND_INTERVAL);
  }

  _clearPingTimer() {
    if (this._pingTimer != null) {
      clearTimeout(this._pingTimer);
      this._pingTimer = null;
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) {
      return;
    }
    // Exponential reconnect time trials.
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (this.isDisconnected()) {
        this._reconnect();
      }
    }, this._reconnectTime);
    this._reconnectTime = this._reconnectTime * 2;
    if (this._reconnectTime > MAX_RECONNECT_TIME_MS) {
      this._reconnectTime = MAX_RECONNECT_TIME_MS;
    }
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  send(message: string): void {
    // "this.isClosed()" but flow understands it
    if (this._transport == null) {
      throw new Error(
        `Sending message to server ${this._serverUri} on closed socket ${
          this.id
        }: ${message}`,
      );
    }
    this._transport.send(message);
  }

  // Resolves if the connection looks healthy.
  // Will reject quickly if the connection looks unhealthy.
  testConnection(): Promise<string> {
    return this._heartbeat.sendHeartBeat();
  }

  getAddress(): string {
    return this._serverUri;
  }

  getServerUri(): string {
    return this._serverUri;
  }

  getServerPort(): ?number {
    const {port} = url.parse(this.getServerUri());
    if (port == null) {
      return null;
    }
    return Number(port);
  }

  close() {
    const transport = this._transport;
    if (transport != null) {
      this._transport = null;
      transport.close();
      this._emitter.emit('close');
    }
    this._clearReconnectTimer();
    this._reconnectTime = INITIAL_RECONNECT_TIME_MS;
    this._heartbeat.close();
  }

  isClosed(): boolean {
    return this._transport == null;
  }

  onMessage(): Observable<string> {
    if (this.isClosed()) {
      return Observable.throw(
        `Socket ${this.id} to server ${this._serverUri} is closed`,
      );
    }
    invariant(this._transport != null);
    return this._transport.onMessage();
  }

  onStatus(callback: (connected: boolean) => mixed): IDisposable {
    return this._emitter.on('status', callback);
  }

  onConnect(callback: () => mixed): IDisposable {
    return this._emitter.on('connect', callback);
  }

  onReconnect(callback: () => mixed): IDisposable {
    return this._emitter.on('reconnect', callback);
  }

  onDisconnect(callback: () => mixed): IDisposable {
    return this._emitter.on('disconnect', callback);
  }

  /**
   * Called if there is an intransient error. I.e. when we cannot recover from
   * an error by attempting to reconnect. It is up to the listener to decide
   * whether to close this socket.
   */
  onIntransientError(callback: (error: Error) => mixed): IDisposable {
    return this._emitter.on('intransient-error', callback);
  }

  /**
   * Called just once if the state of this socket goes from opened to closed.
   * E.g. this socket is closed via its `close` method.
   */
  onClose(callback: () => mixed): IDisposable {
    return this._emitter.on('close', callback);
  }
}
