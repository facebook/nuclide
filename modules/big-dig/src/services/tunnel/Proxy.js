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

import type {Observable} from 'rxjs';
import type {TunnelMessage, TunnelConfig} from './types';

import net from 'net';
import Encoder from './Encoder';

import {getLogger} from 'log4js';
import invariant from 'assert';
import EventEmitter from 'events';
import {getProxyConfigDescriptor} from './ProxyConfigUtils';

const logger = getLogger('tunnel-proxy');

export type Transport = {
  send(string): void,
  onMessage(): Observable<string>,
};

export class Proxy extends EventEmitter {
  _tunnelConfig: TunnelConfig;
  _transport: Transport;
  _server: ?net.Server;
  _socketByClientId: Map<number, net.Socket>;
  _tunnelId: string;

  constructor(
    tunnelId: string,
    tunnelConfig: TunnelConfig,
    transport: Transport,
  ) {
    super();
    this._tunnelId = tunnelId;
    this._tunnelConfig = tunnelConfig;
    this._transport = transport;
    this._server = null;
    this._socketByClientId = new Map();
  }

  static async createProxy(
    tunnelId: string,
    tunnelConfig: TunnelConfig,
    transport: Transport,
  ): Promise<Proxy> {
    const proxy = new Proxy(tunnelId, tunnelConfig, transport);
    await proxy.startListening();

    return proxy;
  }

  async startListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._server = net.createServer(socket => {
        const clientId: number = socket.remotePort;
        this._sendMessage({
          event: 'connection',
          clientId,
          tunnelId: this._tunnelId,
        });

        // forward events over the transport
        // NOTE: Needs to be explicit otherwise Flow will complain about the
        // type. We prefer this as opposed to using `any` types in such important infra code.
        socket.on('timeout', arg => {
          this._sendMessage({
            event: 'timeout',
            arg,
            clientId,
            tunnelId: this._tunnelId,
          });
        });
        socket.on('end', arg => {
          this._sendMessage({
            event: 'end',
            arg,
            clientId,
            tunnelId: this._tunnelId,
          });
        });
        socket.on('close', arg => {
          this._sendMessage({
            event: 'close',
            arg,
            clientId,
            tunnelId: this._tunnelId,
          });
        });
        socket.on('data', arg => {
          this._sendMessage({
            event: 'data',
            arg,
            clientId,
            tunnelId: this._tunnelId,
          });
        });

        socket.on('error', error => {
          logger.error('error on socket: ', error);
          this._sendMessage({
            event: 'error',
            error,
            tunnelId: this._tunnelId,
            clientId,
          });
          socket.destroy(error);
        });
        socket.on('close', () => this._deleteSocket(clientId));

        this._socketByClientId.set(clientId, socket);
      });

      this._server.on('error', error => {
        logger.error(
          `error when listening on ${getProxyConfigDescriptor(
            this._tunnelConfig.local,
          )}: `,
          error,
        );
        this._sendMessage({
          event: 'proxyError',
          tunnelConfig: this._tunnelConfig,
          error,
          tunnelId: this._tunnelId,
        });
        reject(error);
      });

      invariant(this._server);
      this._server.listen(this._tunnelConfig.local, () => {
        logger.info(
          `successfully started listening on ${getProxyConfigDescriptor(
            this._tunnelConfig.local,
          )}`,
        );
        // send a message to create the SocketManager
        this._sendMessage({
          event: 'proxyCreated',
          proxyConfig: this._tunnelConfig.remote,
          tunnelId: this._tunnelId,
        });
        resolve();
      });
    });
  }

  getId(): string {
    return this._tunnelId;
  }

  receive(msg: TunnelMessage): void {
    switch (msg.event) {
      case 'data':
        this._forwardData(msg.clientId, msg.arg);
        return;
      case 'close':
        this._ensureSocketClosed(msg.clientId);
        return;
      case 'error':
        this._destroySocket(msg.clientId, msg.error);
        return;
      case 'end':
        this._endSocket(msg.clientId);
        return;
      default:
        throw new Error(`Invalid tunnel message: ${msg.event}`);
    }
  }

  _forwardData(id: number, data: string) {
    const socket = this._socketByClientId.get(id);
    if (socket != null) {
      socket.write(data);
    } else {
      logger.error(`data loss - socket already closed or nonexistent: ${id}`);
    }
  }

  _deleteSocket(id: number) {
    logger.info(`socket ${id} closed`);
    const socket = this._socketByClientId.get(id);
    invariant(socket);
    socket.removeAllListeners();
    this._socketByClientId.delete(id);
  }

  _destroySocket(id: number, error: Error) {
    const socket = this._socketByClientId.get(id);
    if (socket != null) {
      socket.destroy(error);
    } else {
      logger.info(
        `no socket ${id} found for ${
          error.message
        }, this is expected if it was closed recently`,
      );
    }
  }

  _endSocket(id: number) {
    const socket = this._socketByClientId.get(id);
    if (socket != null) {
      socket.end();
    } else {
      logger.info(
        `no socket ${id} found to be ended, this is expected if it was closed recently`,
      );
    }
  }

  _ensureSocketClosed(id: number) {
    const socket = this._socketByClientId.get(id);
    if (socket != null) {
      logger.info(`socket ${id} wasn't closed in time, force closing it`);
      socket.destroy();
    }
  }

  _sendMessage(msg: TunnelMessage): void {
    this._transport.send(Encoder.encode(msg));
  }

  close(): void {
    if (this._server != null) {
      this._server.close();
      this._server = null;
    }
    this._socketByClientId.forEach((socket, id) => {
      socket.end();
    });
    this.removeAllListeners();
    this._sendMessage({event: 'proxyClosed', tunnelId: this._tunnelId});
  }
}
