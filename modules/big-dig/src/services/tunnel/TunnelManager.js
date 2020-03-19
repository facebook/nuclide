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

import type {Subscription} from 'rxjs';
import type {Transport} from './Proxy';
import type {TunnelConfig} from './types';

import {SocketManager} from './SocketManager';
import {Proxy} from './Proxy';
import {Tunnel} from './Tunnel';
import Encoder from './Encoder';
import EventEmitter from 'events';
import invariant from 'assert';
import {getLogger} from 'log4js';
import {getDescriptor} from './TunnelConfigUtils';

/**
 * A tunnel consists of two components: a Proxy to listen for connections,
 * and a SocketManager to handle TCP socket connections from the proxy.
 *
 * There are two types of tunnels. A normal tunnel is one where the proxy runs
 * on the client and proxies connections to a remote TCP port on the server.
 * There's also  reverse tunnel where the proxy runs on the server and it
 * proxies connections to the client.
 *
 * On the client, the TunnelManager maintains a Map of Tunnels it has handed
 * back to clients. On the server, the TunnelManager maintains a map to its
 * associated TunnelComponent (either the Proxy or the SocketManager).
 *
 * When the client closes tunnel, it sends a message to the server to close
 * the associated component that is running on the server.
 */

export class TunnelManager extends EventEmitter {
  _transport: Transport;
  // on the client (where tunnels are created), we always map to a Tunnel.
  // on the server, we map to either a SocketManager or a Proxy, depending
  // on whether we are a reverse tunnel or not
  _idToTunnel: Map<string, Tunnel | SocketManager | Proxy>;
  _logger: log4js$Logger;
  _subscription: Subscription;
  _isClosed: boolean;

  constructor(transport: Transport) {
    super();
    this._transport = transport;
    this._idToTunnel = new Map();
    this._logger = getLogger('tunnel-manager');
    this._isClosed = false;

    this._subscription = this._transport
      .onMessage()
      .map(msg => {
        return Encoder.decode(msg);
      })
      .subscribe(msg => this._handleMessage(msg));
  }

  async createTunnel(tunnelConfig: TunnelConfig): Promise<Tunnel> {
    invariant(
      !this._isClosed,
      'trying to create a tunnel with a closed tunnel manager',
    );

    this._logger.info(`creating tunnel ${getDescriptor(tunnelConfig, false)}`);
    return this._createTunnel(tunnelConfig, false);
  }

  async createReverseTunnel(tunnelConfig: TunnelConfig): Promise<Tunnel> {
    invariant(
      !this._isClosed,
      'trying to create a reverse tunnel with a closed tunnel manager',
    );

    this._logger.info(
      `creating reverse tunnel ${getDescriptor(tunnelConfig, true)}`,
    );

    return new Promise(async (resolve, reject) => {
      const tunnel = await this._createTunnel(tunnelConfig, true);

      // now wait until we get the 'proxyCreated' or 'proxyError' message
      this.once(`proxyMessage:${tunnel.getId()}`, msg => {
        if (msg.event === 'proxyCreated') {
          resolve(tunnel);
        } else if (msg.event === 'proxyError') {
          tunnel.close();
          reject(msg.error);
        } else {
          reject(new Error('unexpected response to createProxy'));
        }
      });
    });
  }

  async _createTunnel(tunnelConfig: TunnelConfig, isReverse: boolean) {
    let tunnel = this._checkForExistingTunnel(tunnelConfig, isReverse);

    if (tunnel == null) {
      if (isReverse) {
        tunnel = await Tunnel.createReverseTunnel(
          tunnelConfig,
          this._transport,
        );
      } else {
        tunnel = await Tunnel.createTunnel(tunnelConfig, this._transport);
      }
      this._idToTunnel.set(tunnel.getId(), tunnel);
      tunnel.once('close', () => {
        invariant(tunnel != null);
        this._idToTunnel.delete(tunnel.getId());
      });
    } else {
      tunnel.incrementRefCount();
    }
    return tunnel;
  }

  close(): void {
    this._logger.trace('closing tunnel manager');
    this._idToTunnel.forEach(tunnel => {
      if (tunnel instanceof SocketManager || tunnel instanceof Proxy) {
        tunnel.close();
      } else {
        tunnel.forceClose();
      }
    });
    this._idToTunnel.clear();
    this._isClosed = true;
  }

  get tunnels(): Array<Tunnel | SocketManager | Proxy> {
    return Array.from(this._idToTunnel.values());
  }

  _checkForExistingTunnel(
    tunnelConfig: TunnelConfig,
    isReverse: boolean,
  ): ?Tunnel {
    for (const tunnel of this._idToTunnel.values()) {
      if (!(tunnel instanceof Tunnel)) {
        continue;
      }

      if (tunnel.isTunnelConfigEqual(tunnelConfig)) {
        if (isReverse === tunnel.isReverse()) {
          return tunnel;
        } else {
          throw new Error(
            "there is already a tunnel with those ports, but it's in the wrong direction",
          );
        }
      }
      tunnel.assertNoOverlap(tunnelConfig);
    }
  }

  async _handleMessage(msg: Object /* TunnelMessage? */): Promise<void> {
    const tunnelComponent = this._idToTunnel.get(msg.tunnelId);
    if (msg.event === 'proxyCreated') {
      if (tunnelComponent == null) {
        const socketManager = new SocketManager(
          msg.tunnelId,
          msg.proxyConfig,
          this._transport,
        );

        this._idToTunnel.set(msg.tunnelId, socketManager);
      }
      this.emit(`proxyMessage:${msg.tunnelId}`, msg);
    } else if (msg.event === 'proxyError') {
      this._logger.error('error creating proxy: ', msg);
      this.emit(`proxyMessage:${msg.tunnelId}`, msg);
    } else if (msg.event === 'proxyClosed') {
      // in the case of a reverse tunnel, we get the proxyClosed event
      // after we actually close the tunnel, so we ignore it.
      if (tunnelComponent != null) {
        invariant(tunnelComponent);
        tunnelComponent.close();
        this._idToTunnel.delete(tunnelComponent.getId());
      }
    } else if (msg.event === 'createProxy') {
      try {
        const proxy = await Proxy.createProxy(
          msg.tunnelId,
          msg.tunnelConfig,
          this._transport,
        );
        this._idToTunnel.set(msg.tunnelId, proxy);
      } catch (e) {
        // We already responded with proxyError, nothing else to do
      }
    } else if (msg.event === 'closeProxy') {
      if (tunnelComponent == null) {
        // TODO T33725076: Shouldn't have message to closed tunnels
        this._logger.error(
          'Receiving a closeProxy message to a closed tunnel',
          msg,
        );
      } else {
        tunnelComponent.close();
      }
    } else {
      if (tunnelComponent == null) {
        // TODO T33725076: Shouldn't have message to closed tunnels
        this._logger.error('Receiving a message to a closed tunnel', msg);
      } else {
        tunnelComponent.receive(msg);
      }
    }
  }
}
