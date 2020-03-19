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
import type {Transport} from '../../server/BigDigServer';
import type {
  ThriftServiceCommand,
  ThriftServerConfig,
  ThriftServiceConfig,
  ThriftClient,
  ConnectionOptions,
} from './types';

import {getAvailableServerPort} from 'nuclide-commons/serverPort';
import {getLogger} from 'log4js';
import invariant from 'assert';
import {Tunnel} from '../tunnel/Tunnel';
import {TunnelManager} from '../tunnel/TunnelManager';
import EventEmitter from 'events';

import {getWrappedThriftClient} from './createThriftClient';
import {encodeMessage, decodeMessage} from './util';
import {convertToServerConfig, genConfigId} from './config-utils';

// Every client increase tunnel's refCount by 1, while closing it, we need to
// reduce tunnel refCount by 1. The reason we want to let ThriftClientManager
// to manager tunnel's refCount instead of directly using Tunnel class' refCount
// is because it is more convenient and robust to let the tunnel's direct
// consumer to manager the refCount.
type TunnelCacheEntry = {tunnel: Tunnel, refCount: number};

// waiting for server response timeout
let remoteCallTimeLimit = 15000;

// create and export for speeding up testing
export function setTimeoutLimit(time: number): void {
  remoteCallTimeLimit = time;
}

/**
 * This class manages the creation and disposal of thrift clients.
 * `ThriftClientManager` instances will be created and managed by BigDigClient
 */
export class ThriftClientManager {
  _transport: Transport;
  _tunnel: Tunnel;
  _tunnelManager: TunnelManager;
  _logger: log4js$Logger;
  _isClosed: boolean;
  _subscription: Subscription;
  _emitter: EventEmitter;
  _messageId: number;
  _clientIndex: number;

  // The following attributes are used to managing multiple Thrift service client
  _clientByClientId: Map<string, ThriftClient>;
  _tunnelByServiceConfigId: Map<string, TunnelCacheEntry>;

  constructor(transport: Transport, tunnelManager: TunnelManager) {
    this._transport = transport;
    this._tunnelManager = tunnelManager;
    this._logger = getLogger('bigdig-thrift-client-manager');
    this._messageId = 0;
    this._clientIndex = 0;
    this._isClosed = false;
    this._emitter = new EventEmitter();

    this._clientByClientId = new Map();
    this._tunnelByServiceConfigId = new Map();

    const observable = this._transport.onMessage();
    // eslint-disable-next-line nuclide-internal/unused-subscription
    observable.subscribe({
      // TODO(terryltang): Temporarily use json format for readability, later
      // consider to use the new tunnel/Encoder to encode/decode message
      next: value => {
        const response = decodeMessage(value);
        this._emitter.emit(response.id, response);
      },
      error(err) {
        // eslint-disable-next-line no-console
        this._logger.error(
          'Error received in big-dig thrift client manager!',
          err,
        );
      },
      complete() {
        // eslint-disable-next-line no-console
        this._logger.error(
          'big-dig thrift client manager transport subscription completed',
        );
      },
    });
  }

  /**
   * Returns a new thrift client.
   *
   * NOTE: Two clients with the same service config will share the same tunnel
   * to the remote server.
   */
  async createThriftClient(
    serviceConfig: ThriftServiceConfig,
  ): Promise<ThriftClient> {
    invariant(!this._isClosed, 'big-dig thrift client manager is closed');

    const port = await this._getOrCreateTunnel(serviceConfig);
    const clientId = `${serviceConfig.name}\0${this._clientIndex++}`;
    const client = getWrappedThriftClient(serviceConfig, port);
    const clientDispose = () => {
      this._clientByClientId.delete(clientId);
      this._closeTunnel(serviceConfig);
    };
    client.onClientClose(clientDispose);
    client.onUnexpectedClientFailure(clientDispose);
    this._clientByClientId.set(clientId, client);
    return client;
  }

  /**
   * Expect result from remote methods. Here return type `any` can be downcasted
   * to other expected data types in callers
   */
  async _runThriftServiceCommand(
    command: ThriftServiceCommand,
    serverConfig: ThriftServerConfig,
  ): Promise<any> {
    const id = (this._messageId++).toString(16);
    const response = new Promise((resolve, reject) => {
      let timeoutHandler = setTimeout(() => {
        this._emitter.removeListener(id, onResponse);
        reject(
          new Error(
            `Service: ${serverConfig.name} command: ${command} timeout`,
          ),
        );
        timeoutHandler = null;
      }, remoteCallTimeLimit);
      function onResponse(message): void {
        if (timeoutHandler != null) {
          clearTimeout(timeoutHandler);
        }
        if (message.payload.success) {
          resolve(message.payload.connectionOptions);
        } else {
          reject(new Error(message.payload.error));
        }
      }
      this._emitter.once(id, onResponse);
    });
    const message = {
      id,
      payload: {type: 'request', command, serverConfig},
    };
    this._transport.send(encodeMessage(message));
    return response;
  }

  _createRemoteServer(
    serverConfig: ThriftServerConfig,
  ): Promise<ConnectionOptions> {
    return this._runThriftServiceCommand('start-server', serverConfig);
  }

  _closeRemoteServer(serverConfig: ThriftServerConfig): Promise<any> {
    return this._runThriftServiceCommand('stop-server', serverConfig);
  }

  async _getOrCreateTunnel(
    serviceConfig: ThriftServiceConfig,
  ): Promise<number> {
    const serviceConfigId = genConfigId(serviceConfig);
    const tunnelCacheEntry = this._tunnelByServiceConfigId.get(serviceConfigId);
    let tunnel = null;

    if (tunnelCacheEntry != null) {
      this._logger.info(`Using an existent tunnel for ${serviceConfig.name}`);
      tunnel = tunnelCacheEntry.tunnel;
      tunnelCacheEntry.refCount++;
    } else {
      this._logger.info(`Creating a new tunnel for ${serviceConfig.name}`);
      const serverConfig = convertToServerConfig(serviceConfig);
      const remoteConnectionOptions = await this._createRemoteServer(
        serverConfig,
      );
      const localPort = await getAvailableServerPort();
      const useIPv4 = false;
      tunnel = await this._tunnelManager.createTunnel({
        local: {port: localPort, useIPv4},
        remote: remoteConnectionOptions,
      });
      this._tunnelByServiceConfigId.set(serviceConfigId, {tunnel, refCount: 1});
    }
    const localProxyConfig = tunnel.getConfig().local;
    if (localProxyConfig.path === undefined) {
      return localProxyConfig.port;
    }
    throw new Error(
      'Big Dig has no IPC Socket support at this time for Thrift clients.',
    );
  }

  async _closeTunnel(serviceConfig: ThriftServiceConfig): Promise<void> {
    const serviceConfigId = genConfigId(serviceConfig);
    const tunnelCacheEntry = this._tunnelByServiceConfigId.get(serviceConfigId);
    if (tunnelCacheEntry == null) {
      throw new Error(`Expected tunnel to be open: ${serviceConfig.name}`);
    }
    if (tunnelCacheEntry.refCount === 1) {
      this._tunnelByServiceConfigId.delete(serviceConfigId);
      tunnelCacheEntry.tunnel.close();
      await this._closeRemoteServer(convertToServerConfig(serviceConfig));
    } else {
      tunnelCacheEntry.refCount -= 1;
    }
  }

  close(): void {
    if (this._isClosed) {
      return;
    }
    this._isClosed = true;
    this._logger.info('Close Big-Dig thrift client manager!');
    for (const client of this._clientByClientId.values()) {
      client.close();
    }
    this._emitter.removeAllListeners();
  }
}
