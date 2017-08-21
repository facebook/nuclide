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

import type {RequestOptions} from './utils';
import type {AgentOptions} from './main';
import {asyncRequest} from './utils';
import {Emitter} from 'event-kit';
import {HEARTBEAT_CHANNEL} from './config';

const HEARTBEAT_INTERVAL_MS = 10000;
const HEARTBEAT_TIMEOUT_MS = 10000;
const MAX_HEARTBEAT_AWAY_RECONNECT_MS = 60000;

export class XhrConnectionHeartbeat {
  _heartbeatConnectedOnce: boolean;
  _lastHeartbeat: ?('here' | 'away');
  _lastHeartbeatTime: ?number;
  _heartbeatInterval: ?number;
  _emitter: Emitter;
  _options: RequestOptions;

  constructor(serverUri: string, agentOptions: ?AgentOptions) {
    this._heartbeatConnectedOnce = false;
    this._lastHeartbeat = null;
    this._lastHeartbeatTime = null;
    const options: RequestOptions = {
      uri: serverUri + '/' + HEARTBEAT_CHANNEL,
      method: 'POST',
      timeout: HEARTBEAT_TIMEOUT_MS,
    };
    if (agentOptions != null) {
      options.agentOptions = agentOptions;
    }
    this._options = options;
    this._emitter = new Emitter();

    this._monitorServerHeartbeat();
  }

  _monitorServerHeartbeat(): void {
    this._heartbeat();
    this._heartbeatInterval = setInterval(
      () => this._heartbeat(),
      HEARTBEAT_INTERVAL_MS,
    );
  }

  // Returns version
  async sendHeartBeat(): Promise<string> {
    const {body} = await asyncRequest(this._options);
    return body;
  }

  async _heartbeat(): Promise<void> {
    try {
      await this.sendHeartBeat();
      this._heartbeatConnectedOnce = true;
      const now = Date.now();
      // flowlint-next-line sketchy-null-number:off
      this._lastHeartbeatTime = this._lastHeartbeatTime || now;
      if (
        this._lastHeartbeat === 'away' ||
        now - this._lastHeartbeatTime > MAX_HEARTBEAT_AWAY_RECONNECT_MS
      ) {
        // Trigger a websocket reconnect.
        this._emitter.emit('reconnect');
      }
      this._lastHeartbeat = 'here';
      this._lastHeartbeatTime = now;
      this._emitter.emit('heartbeat');
    } catch (err) {
      this._lastHeartbeat = 'away';
      // Error code could could be one of:
      // ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']
      // A heuristic mapping is done between the xhr error code to the state of server connection.
      const {code: originalCode, message} = err;
      let code = null;
      switch (originalCode) {
        case 'ENOTFOUND':
        // A socket operation failed because the network was down.
        // falls through
        case 'ENETDOWN':
        // The range of the temporary ports for connection are all taken,
        // This is temporal with many http requests, but should be counted as a network away event.
        // falls through
        case 'EADDRNOTAVAIL':
        // The host server is unreachable, could be in a VPN.
        // falls through
        case 'EHOSTUNREACH':
        // A request timeout is considered a network away event.
        // falls through
        case 'ETIMEDOUT':
        case 'ESOCKETTIMEDOUT':
          code = 'NETWORK_AWAY';
          break;
        case 'ECONNREFUSED':
          // Server shut down or port no longer accessible.
          if (this._heartbeatConnectedOnce) {
            code = 'SERVER_CRASHED';
          } else {
            code = 'PORT_NOT_ACCESSIBLE';
          }
          break;
        case 'ECONNRESET':
          code = 'INVALID_CERTIFICATE';
          break;
        default:
          code = originalCode;
          break;
      }
      this._emitter.emit('heartbeat.error', {code, originalCode, message});
    }
  }

  onHeartbeat(callback: () => mixed): IDisposable {
    return this._emitter.on('heartbeat', callback);
  }

  onHeartbeatError(
    callback: (arg: {
      code: string,
      originalCode: string,
      message: string,
    }) => mixed,
  ): IDisposable {
    return this._emitter.on('heartbeat.error', callback);
  }

  onConnectionRestored(callback: () => mixed): IDisposable {
    return this._emitter.on('reconnect', callback);
  }

  close() {
    if (this._heartbeatInterval != null) {
      clearInterval(this._heartbeatInterval);
    }
  }
}
