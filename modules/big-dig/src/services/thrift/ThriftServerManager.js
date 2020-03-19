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

import type {Subscription} from 'rxjs';
import type {
  FailureResponse,
  SuccessResponse,
  ThriftMessage,
  ThriftServer,
  ThriftServerConfig,
  ConnectionOptions,
} from './types';
import type {Transport} from '../../server/BigDigServer';

import {getLogger} from 'log4js';
import invariant from 'assert';
import {createThriftServer} from './createThriftServer';
import {encodeMessage, decodeMessage} from './util';
import {genConfigId} from './config-utils';

type ServerCacheEntry = {server: ThriftServer, refCount: number};

const logger = getLogger('bigdig-thrift-service-manager');

/**
 * This class manages the creation and disposal of thrift servers. A new server
 * processes will be spawned by a recieving `create_server` command with its
 * `ThriftServerConfig` configuration data. And the spawned servers and their
 * refCount numbers will be maintained in a `_configIdToServer` map. A server
 * will be shut down once its refCount number is 0.
 *
 * Different from `ThriftClientManager``, `ThriftServerManager` will be launched
 * by the Thrift service launcher. Once the Big-Dig connection is made and this
 * server manager isready to use, we can use this manager to handler message
 * from `BigDigClient` to spawn new thrift service server.
 */
export class ThriftServerManager {
  _transport: Transport;
  _subscription: Subscription;
  _configIdToServer: Map<string, ServerCacheEntry>;

  constructor(transport: Transport) {
    this._transport = transport;
    this._configIdToServer = new Map();

    // Transport onMessage returns observable
    this._subscription = this._transport
      .onMessage()
      .map(message => decodeMessage(message))
      .subscribe(message => this._handleMessage(message));
  }

  /**
   * @param message On server side, servers only deal with request messages and
   * do not expect response messages.
   */
  async _handleMessage(message: ThriftMessage): Promise<void> {
    const {id, payload} = message;
    logger.info('------- received message --------');
    logger.info(message);
    if (id == null || payload == null) {
      const errorMessage = 'Malformatted request message!';
      this._sendMessage(createFailureMessage(id, errorMessage));
      return;
    }
    // server does not expect response message
    invariant(payload.type === 'request');
    const {command, serverConfig} = payload;
    if (command == null || serverConfig == null) {
      const errorMessage = 'Malformatted request message!';
      this._sendMessage(createFailureMessage(id, errorMessage));
      return;
    }

    if (command === 'start-server') {
      await this._startServer(id, serverConfig);
    } else if (command === 'stop-server') {
      await this._stopServer(id, serverConfig);
    } else {
      logger.error(`Got unknown command ${command}`);
    }
  }

  async _startServer(
    id: string,
    serverConfig: ThriftServerConfig,
  ): Promise<void> {
    // NOTE: In fact, if serviceName to its service config is 1:1 mapping, we
    // could simply use serviceNames as map keys here. Just in case in future,
    // the serviceName to service config mapping becomes 1:n, the following
    // configId will still work
    const configId = genConfigId(serverConfig);
    const serverCacheEntry = this._configIdToServer.get(configId);
    let messagePayload;
    // server already exist, increase server refCount
    if (serverCacheEntry != null) {
      const {server, refCount} = serverCacheEntry;
      logger.info('Server is already running for %s', configId);
      this._configIdToServer.set(configId, {
        server,
        refCount: refCount + 1,
      });
      messagePayload = createSuccessResponse(server.getConnectionOptions());
    } else {
      try {
        const server = await createThriftServer(serverConfig);
        this._configIdToServer.set(configId, {refCount: 1, server});
        messagePayload = createSuccessResponse(server.getConnectionOptions());
      } catch (error) {
        messagePayload = createFailureResponse('Failed to create server');
        logger.error('Failed to create server ', error);
      }
    }
    const responseMessage = {id, payload: messagePayload};
    this._sendMessage(responseMessage);
  }

  async _stopServer(
    id: string,
    serverConfig: ThriftServerConfig,
  ): Promise<void> {
    const configId = genConfigId(serverConfig);
    const serverCacheEntry = this._configIdToServer.get(configId);
    if (serverCacheEntry != null) {
      const {server, refCount} = serverCacheEntry;
      if (refCount > 1) {
        this._configIdToServer.set(configId, {
          server,
          refCount: refCount - 1,
        });
      } else {
        // If refCount == 1, the close message send from its last Thrift client
        server.close();
        this._configIdToServer.delete(configId);
      }
    }
    const messagePayload = {type: 'response', success: true};
    const responseMessage = {id, payload: messagePayload};
    this._sendMessage(responseMessage);
  }

  _sendMessage(message: ThriftMessage): void {
    this._transport.send(encodeMessage(message));
  }
}

function createSuccessResponse(
  connectionOptions: ConnectionOptions,
): SuccessResponse {
  return {
    type: 'response',
    success: true,
    connectionOptions,
  };
}

function createFailureResponse(errorMessage: string): FailureResponse {
  return {
    type: 'response',
    success: false,
    error: errorMessage,
  };
}

function createFailureMessage(id: string, errorMessage: string): ThriftMessage {
  return {
    id,
    payload: createFailureResponse(errorMessage),
  };
}
