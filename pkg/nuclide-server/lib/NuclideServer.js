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

import type {ConfigEntry} from '../../nuclide-rpc/lib/types';

import invariant from 'assert';
import os from 'os';
import {getLogger} from 'log4js';
import WS from 'ws';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import blocked from './blocked';
import {QueuedAckTransport} from 'big-dig/src/socket/QueuedAckTransport';
import {deserializeArgs, sendJsonResponse, sendTextResponse} from './utils';
import {HistogramTracker} from 'nuclide-analytics';
import {getVersion} from '../../nuclide-version';
import {flushLogsAndExit} from '../../nuclide-logging';
import {RpcConnection, ServiceRegistry} from '../../nuclide-rpc';
import {WebSocketTransport} from 'big-dig/src/socket/WebSocketTransport';
import {getServerSideMarshalers} from '../../nuclide-marshalers-common';
import {protocolLogger} from './utils';
import {track} from 'nuclide-analytics';

export const HEARTBEAT_CHANNEL = 'heartbeat';

// eslint-disable-next-line nuclide-internal/no-commonjs
const connect: connect$module = require('connect');
// eslint-disable-next-line nuclide-internal/no-commonjs
const http: http$fixed = (require('http'): any);
// eslint-disable-next-line nuclide-internal/no-commonjs
const https: https$fixed = (require('https'): any);

const logger = getLogger('nuclide-server');

type NuclideServerOptions = {
  port: number,
  serverKey?: Buffer,
  serverCertificate?: Buffer,
  certificateAuthorityCertificate?: Buffer,
  trackEventLoop?: boolean,
};

export default class NuclideServer {
  static _theServer: ?NuclideServer;
  static _shutdownCallbacks: Set<() => void> = new Set();

  _webServer: http$fixed$Server;
  _webSocketServer: WS.Server;
  _clients: Map<string, RpcConnection<QueuedAckTransport>>;
  _port: number;
  _app: connect$Server;
  _xhrServiceRegistry: {[serviceName: string]: () => any};
  _version: string;
  _rpcServiceRegistry: ServiceRegistry;
  _disposables: UniversalDisposable = new UniversalDisposable();

  constructor(options: NuclideServerOptions, services: Array<ConfigEntry>) {
    invariant(NuclideServer._theServer == null);
    NuclideServer._theServer = this;

    const {
      serverKey,
      serverCertificate,
      port,
      certificateAuthorityCertificate,
      trackEventLoop,
    } = options;

    this._version = getVersion().toString();
    this._app = connect();
    this._attachUtilHandlers();
    const isHttps = Boolean(
      serverKey && serverCertificate && certificateAuthorityCertificate,
    );
    if (isHttps) {
      const webServerOptions = {
        key: serverKey,
        cert: serverCertificate,
        ca: certificateAuthorityCertificate,
        requestCert: true,
        rejectUnauthorized: true,
      };

      this._webServer = https.createServer(webServerOptions, this._app);
    } else {
      this._webServer = http.createServer(this._app);
    }
    this._port = port;

    this._webSocketServer = this._createWebSocketServer();
    this._clients = new Map();

    this._setupServices(); // Setup 1.0 and 2.0 services.

    if (trackEventLoop) {
      const stallTracker = new HistogramTracker(
        'server-event-loop-blocked',
        /* max */ 1000,
        /* buckets */ 10,
      );
      this._disposables.add(
        stallTracker,
        blocked((ms: number) => {
          stallTracker.track(ms);
          logger.info('NuclideServer event loop blocked for ' + ms + 'ms');
        }),
      );
    }

    this._rpcServiceRegistry = new ServiceRegistry(
      getServerSideMarshalers,
      services,
    );

    track('server-created', {port, isHttps, host: os.hostname()});
  }

  _attachUtilHandlers() {
    // Add specific method handlers.
    ['get', 'post', 'delete', 'put'].forEach(methodName => {
      // $FlowFixMe - Use map instead of computed property on library type.
      this._app[methodName] = (uri, handler) => {
        /* $FlowFixMe(>=0.86.0) This
         * comment suppresses an error found when Flow v0.86 was
         * deployed. To see the error, delete this comment and
         * run Flow. */
        this._app.use(uri, (request, response, next) => {
          if (request.method.toUpperCase() !== methodName.toUpperCase()) {
            // skip if method doesn't match.
            return next();
          } else {
            handler(request, response, next);
          }
        });
      };
    });
  }

  _createWebSocketServer(): WS.Server {
    const webSocketServer = new WS.Server({
      server: this._webServer,
      perMessageDeflate: true,
    });
    webSocketServer.on('connection', (socket, req) =>
      this._onConnection(socket, req),
    );
    webSocketServer.on('error', error =>
      logger.error('WebSocketServer Error:', error),
    );
    return webSocketServer;
  }

  _setupServices() {
    // Lazy require these functions so that we could spyOn them while testing in
    // ServiceIntegrationTestHelper.
    this._xhrServiceRegistry = {};
    this._setupHeartbeatHandler();

    // Setup error handler.
    this._app.use(
      (
        error: ?connect$Error,
        request: http$fixed$IncomingMessage,
        response: http$fixed$ServerResponse,
        next: Function,
      ) => {
        if (error != null) {
          sendJsonResponse(
            response,
            {code: error.code, message: error.message},
            500,
          );
        } else {
          next();
        }
      },
    );
  }

  _setupHeartbeatHandler() {
    this._registerService(
      '/' + HEARTBEAT_CHANNEL,
      async () => this._version,
      'post',
      true,
    );
  }

  static shutdown(): void {
    logger.info('Shutting down the server');
    for (const callback of NuclideServer._shutdownCallbacks) {
      try {
        callback();
      } catch (e) {
        logger.error('Error when executing shutdown callback:', e);
      }
    }
    try {
      if (NuclideServer._theServer != null) {
        NuclideServer._theServer.close();
      }
    } catch (e) {
      logger.error('Error while shutting down, but proceeding anyway:', e);
    } finally {
      flushLogsAndExit(0);
    }
  }

  static registerShutdownCallback(callback: () => void): IDisposable {
    NuclideServer._shutdownCallbacks.add(callback);
    return {dispose: () => NuclideServer._shutdownCallbacks.delete(callback)};
  }

  static closeConnection(client: RpcConnection<QueuedAckTransport>): void {
    logger.info(`Closing client: #${client.getTransport().id}`);
    if (NuclideServer._theServer != null) {
      NuclideServer._theServer._closeConnection(client);
    }
  }

  _closeConnection(client: RpcConnection<QueuedAckTransport>): void {
    if (this._clients.get(client.getTransport().id) === client) {
      this._clients.delete(client.getTransport().id);
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._webServer.on('listening', () => {
        resolve();
      });
      this._webServer.on('error', e => {
        this._webServer.removeAllListeners();
        reject(e);
      });
      this._webServer.listen(this._port);
    });
  }

  /**
   * Calls a registered service with a name and arguments.
   */
  callService(serviceName: string, args: Array<any>): Promise<any> {
    const serviceFunction = this._xhrServiceRegistry[serviceName];
    if (!serviceFunction) {
      throw new Error('No service registered with name: ' + serviceName);
    }
    return serviceFunction.apply(this, args);
  }

  /**
   * Registers a service function to a service name.
   * This allows simple future calls of the service by name and arguments or http-triggered
   * endpoint calls with arguments serialized over http.
   */
  _registerService(
    serviceName: string,
    serviceFunction: () => Promise<any>,
    method: string,
    isTextResponse: boolean,
  ) {
    if (this._xhrServiceRegistry[serviceName]) {
      throw new Error(
        'A service with this name is already registered: ' + serviceName,
      );
    }
    this._xhrServiceRegistry[serviceName] = serviceFunction;
    this._registerHttpService(serviceName, method, isTextResponse);
  }

  _registerHttpService(
    serviceName: string,
    method: string,
    isTextResponse: ?boolean,
  ) {
    const loweredCaseMethod = method.toLowerCase();
    // $FlowFixMe - Use map instead of computed property.
    this._app[loweredCaseMethod](
      serviceName,
      async (request, response, next) => {
        try {
          const result = await this.callService(
            serviceName,
            deserializeArgs(request.url),
          );
          if (isTextResponse) {
            sendTextResponse(response, result || '');
          } else {
            sendJsonResponse(response, result);
          }
        } catch (e) {
          // Delegate to the registered connect error handler.
          next(e);
        }
      },
    );
  }

  _onConnection(socket: WS, req: http$IncomingMessage): void {
    logger.debug('WebSocket connecting');

    const clientId = req.headers.client_id;
    logger.info(`received client_id in header ${clientId}`);

    let client: ?RpcConnection<QueuedAckTransport> = null;

    client = this._clients.get(clientId);
    const transport = new WebSocketTransport(clientId, socket);
    if (client == null) {
      client = RpcConnection.createServer(
        this._rpcServiceRegistry,
        new QueuedAckTransport(clientId, transport, protocolLogger),
        {},
        clientId,
        protocolLogger,
      );
      this._clients.set(clientId, client);
    } else {
      invariant(clientId === client.getTransport().id);
      client.getTransport().reconnect(transport);
    }
  }

  close(): Promise<void> {
    return new Promise(resolve => {
      invariant(NuclideServer._theServer === this);
      NuclideServer._theServer = null;

      this._disposables.dispose();
      this._webSocketServer.close();
      this._webServer.close(() => {
        resolve();
      });
    });
  }
}
