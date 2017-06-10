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

import type {AgentOptions} from './main';
import type {Observable} from 'rxjs';

import url from 'url';
import WS from 'ws';
import uuid from 'uuid';
import {Emitter} from 'event-kit';
import {WebSocketTransport} from './WebSocketTransport';
import {QueuedTransport} from './QueuedTransport';
import {XhrConnectionHeartbeat} from './XhrConnectionHeartbeat';
import invariant from 'assert';
import {attachEvent} from 'nuclide-commons/event';
import {maybeToString} from 'nuclide-commons/string';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-server');

const PING_SEND_INTERVAL = 5000;
const PING_WAIT_INTERVAL = 5000;

const INITIAL_RECONNECT_TIME_MS = 10;
const MAX_RECONNECT_TIME_MS = 5000;

// The Nuclide Socket class does several things:
//   - Provides a transport mechanism for sending/receiving JSON messages
//   - Provides a transport layer for xhr requests
//   - monitors connection with a heartbeat (over xhr) and automatically attempts to reconnect
//   - caches JSON messages when the connection is down and retries on reconnect
//
// Can be in one of the following states:
//   - Connected - everything healthy
//   - Disconnected - Was connected, but connection died. Will attempt to reconnect.
//   - Closed - No longer connected. May not send/recieve messages. Cannot be resurected.
//
// Publishes the following events:
//   - status(boolean): on connect/disconnect
//   - connect: on first Connection
//   - reconnect: on reestablishing connection after a disconnect
//   - message(message: Object): on receipt fo JSON message
//   - heartbeat: On receipt of successful heartbeat
//   - heartbeat.error({code, originalCode, message}): On failure of heartbeat
export class NuclideSocket {
  id: string;

  _serverUri: string;
  _options: ?AgentOptions;
  _pingTimer: ?number;
  _reconnectTime: number;
  _reconnectTimer: ?number; // ID from a setTimeout() call.
  _previouslyConnected: boolean;
  _websocketUri: string;
  _emitter: Emitter;
  _transport: ?QueuedTransport;
  _heartbeat: XhrConnectionHeartbeat;

  constructor(serverUri: string, options: ?AgentOptions) {
    this._emitter = new Emitter();
    this._serverUri = serverUri;
    this._options = options;
    this.id = uuid.v4();
    this._pingTimer = null;
    this._reconnectTime = INITIAL_RECONNECT_TIME_MS;
    this._reconnectTimer = null;
    this._previouslyConnected = false;
    const transport = new QueuedTransport(this.id);
    this._transport = transport;
    transport.onDisconnect(() => {
      if (this.isDisconnected()) {
        this._emitter.emit('status', false);
        this._emitter.emit('disconnect');
        this._scheduleReconnect();
      }
    });

    const {protocol, host} = url.parse(serverUri);
    // TODO verify that `host` is non-null rather than using maybeToString
    this._websocketUri = `ws${protocol === 'https:' ? 's' : ''}://${maybeToString(host)}`;

    this._heartbeat = new XhrConnectionHeartbeat(serverUri, options);
    this._heartbeat.onConnectionRestored(() => {
      if (this.isDisconnected()) {
        this._scheduleReconnect();
      }
    });

    this._reconnect();
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

    const websocket = new WS(this._websocketUri, this._options);

    // Need to add this otherwise unhandled errors during startup will result
    // in uncaught exceptions. This is due to EventEmitter treating 'error'
    // events specially.
    const onSocketError = error => {
      logger.error(`WebSocket Error while connecting... ${error.message}`);
      if (this.isDisconnected()) {
        logger.info('WebSocket reconnecting after error.');
        this._scheduleReconnect();
      }
    };
    websocket.on('error', onSocketError);

    const onSocketOpen = async () => {
      const sendIdResult = await sendOneMessage(websocket, this.id);
      switch (sendIdResult.kind) {
        case 'close':
          websocket.close();
          logger.info('WebSocket closed before sending id handshake');
          if (this.isDisconnected()) {
            logger.info('WebSocket reconnecting after closed.');
            this._scheduleReconnect();
          }
          break;
        case 'error':
          websocket.close();
          logger.error(
            'WebSocket Error before sending id handshake',
            sendIdResult.message,
          );
          if (this.isDisconnected()) {
            logger.info('WebSocket reconnecting after error.');
            this._scheduleReconnect();
          }
          break;
        case 'success':
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
          break;
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
    invariant(this._transport != null);
    this._transport.send(message);
  }

  // Resolves if the connection looks healthy.
  // Will reject quickly if the connection looks unhealthy.
  testConnection(): Promise<string> {
    return this._heartbeat.sendHeartBeat();
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
    }
    this._clearReconnectTimer();
    this._reconnectTime = INITIAL_RECONNECT_TIME_MS;
    this._heartbeat.close();
  }

  isClosed(): boolean {
    return this._transport == null;
  }

  onHeartbeat(callback: () => mixed): IDisposable {
    return this._heartbeat.onHeartbeat(callback);
  }

  onHeartbeatError(
    callback: (arg: {
      code: string,
      originalCode: string,
      message: string,
    }) => mixed,
  ): IDisposable {
    return this._heartbeat.onHeartbeatError(callback);
  }

  onMessage(): Observable<string> {
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
}

type SendResult =
  | {kind: 'error', message: string}
  | {kind: 'close'}
  | {kind: 'success'};

function sendOneMessage(socket: WS, message: string): Promise<SendResult> {
  return new Promise((resolve, reject) => {
    function finish(result) {
      onError.dispose();
      onClose.dispose();
      resolve(result);
    }
    const onError = attachEvent(socket, 'event', err =>
      finish({kind: 'error', message: err}),
    );
    const onClose = attachEvent(socket, 'close', () => finish({kind: 'close'}));
    socket.send(message, error => {
      if (error == null) {
        finish({kind: 'success'});
      } else {
        finish({kind: 'error', message: error.toString()});
      }
    });
  });
}
