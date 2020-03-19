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

import type {Transport} from './Proxy';
import type {TunnelMessage, TunnelConfig} from './types';

import {
  getProxyConfigDescriptor,
  isProxyConfigEqual,
  isProxyConfigOverlapping,
} from './ProxyConfigUtils';
import {SocketManager} from './SocketManager';
import {Proxy} from './Proxy';
import invariant from 'assert';
import EventEmitter from 'events';
import {getLogger} from 'log4js';

export class Tunnel extends EventEmitter {
  _tunnelConfig: TunnelConfig;
  _transport: Transport;
  _proxy: ?Proxy;
  _id: string;
  _isClosed: boolean;
  _logger: log4js$Logger;
  _refCount: number;

  constructor(
    id: string,
    proxy: ?Proxy,
    tunnelConfig: TunnelConfig,
    transport: Transport,
  ) {
    super();
    this._id = id;
    this._proxy = proxy;
    this._tunnelConfig = tunnelConfig;
    this._transport = transport;
    this._isClosed = false;
    this._logger = getLogger('tunnel');
    this._refCount = 1;

    if (this._proxy != null) {
      this._proxy.once('error', error => {
        this.emit('error', error);
      });
    }
  }

  static async createTunnel(
    tunnelConfig: TunnelConfig,
    transport: Transport,
  ): Promise<Tunnel> {
    const tunnelId = generateId();
    const proxy = await Proxy.createProxy(tunnelId, tunnelConfig, transport);
    return new Tunnel(tunnelId, proxy, tunnelConfig, transport);
  }

  static async createReverseTunnel(
    tunnelConfig: TunnelConfig,
    transport: Transport,
  ): Promise<Tunnel> {
    const tunnelId = generateId();

    const socketManager = new SocketManager(
      tunnelId,
      tunnelConfig.local,
      transport,
    );

    transport.send(
      JSON.stringify(
        ({
          event: 'createProxy',
          tunnelId,
          tunnelConfig: reverseTunnelConfig(tunnelConfig),
        }: TunnelMessage),
      ),
    );

    return new ReverseTunnel(tunnelId, socketManager, tunnelConfig, transport);
  }

  incrementRefCount(): void {
    this._refCount++;
  }

  isTunnelConfigEqual(tunnelConfig: TunnelConfig): boolean {
    return (
      isProxyConfigEqual(tunnelConfig.local, this.getConfig().local) &&
      isProxyConfigEqual(tunnelConfig.remote, this.getConfig().remote)
    );
  }

  assertNoOverlap(tunnelConfig: TunnelConfig) {
    if (isProxyConfigOverlapping(tunnelConfig.local, this.getConfig().local)) {
      throw new Error(
        `there already exists a tunnel connecting to ${getProxyConfigDescriptor(
          tunnelConfig.local,
        )}`,
      );
    }
    if (
      isProxyConfigOverlapping(tunnelConfig.remote, this.getConfig().remote)
    ) {
      throw new Error(
        `there already exists a tunnel connecting to ${getProxyConfigDescriptor(
          tunnelConfig.remote,
        )}`,
      );
    }
  }

  hasReferences(): boolean {
    return this._refCount > 0;
  }

  receive(msg: Object): void {
    if (this._proxy != null) {
      this._proxy.receive(msg);
    }
  }

  getId(): string {
    return this._id;
  }

  getConfig(): TunnelConfig {
    return this._tunnelConfig;
  }

  getRefCount(): number {
    return this._refCount;
  }

  forceClose(): void {
    this._refCount = 0;
    this.close();
  }

  close() {
    this._refCount--;
    if (!this.hasReferences()) {
      this._isClosed = true;
      this.emit('close');
      invariant(this._proxy);
      this._proxy.close();
    }
  }

  isReverse(): boolean {
    return false;
  }
}

export class ReverseTunnel extends Tunnel {
  _socketManager: SocketManager;

  constructor(
    id: string,
    socketManager: SocketManager,
    tunnelConfig: TunnelConfig,
    transport: Transport,
  ) {
    super(id, null, tunnelConfig, transport);
    this._socketManager = socketManager;

    this._socketManager.on('error', error => {
      this.emit('error', error);
    });
  }

  receive(msg: Object): void {
    if (this._socketManager != null) {
      this._socketManager.receive(msg);
    }
  }

  close() {
    this._refCount--;
    if (!this.hasReferences()) {
      this._isClosed = true;
      this.emit('close');
      invariant(this._socketManager);
      this._socketManager.close();
      this._transport.send(
        JSON.stringify(
          ({
            event: 'closeProxy',
            tunnelId: this._id,
          }: TunnelMessage),
        ),
      );
    }
  }

  isReverse(): boolean {
    return true;
  }
}

// TODO: this should really be a UUID
let nextId = 1;
function generateId() {
  return 'tunnel' + nextId++;
}

function reverseTunnelConfig(tunnelConfig: TunnelConfig): TunnelConfig {
  return {
    // NB: on the server, the remote port and local ports are reversed.
    // We want to start the proxy on the remote port (relative to the
    // client) and start the socket manager on the local port
    local: tunnelConfig.remote,
    remote: tunnelConfig.local,
  };
}
