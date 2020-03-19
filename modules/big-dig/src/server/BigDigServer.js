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

import WS from 'ws';
import https from 'https';
import fs from 'fs';
import {getLogger} from 'log4js';
import invariant from 'assert';
import url from 'url';
import {Subject} from 'rxjs';
import {getVersion} from '../common/getVersion';

import {WebSocketTransport} from '../socket/WebSocketTransport';
import {QueuedAckTransport} from '../socket/QueuedAckTransport';
import {scanPortsToListen} from '../common/ports';

// The absolutePathToServerMain must export a single function of this type.
export type LauncherType = (server: BigDigServer) => Promise<void>;

type Certificate = {
  subject: {
    CN: string,
  },
};

export type BigDigServerOptions = {
  // These options will be passed verbatim to https.createServer(). Admittedly,
  // this is not the complete list of options that it takes, but these are the
  // ones we intentionally work with.
  webServer: {
    // Optional private keys in PEM format.
    key?: string | Array<string> | Buffer | Array<Buffer>,
    // Optional cert chains in PEM format
    cert?: string | Array<string> | Buffer | Array<Buffer>,
    // Optionally override the trusted CA certificates.
    ca?: string | Array<string> | Buffer | Array<Buffer>,
  },
  ports: string,
  absolutePathToServerMain: string,
  useRootCanalCerts: boolean,
  // Any sort of JSON-serializable object is fine.
  serverParams: mixed,
};

export const HEARTBEAT_CHANNEL = 'big-dig-heartbeat';
export const CLOSE_TAG = 'big-dig-close-connection';

export type Transport = {
  send(message: string): void,
  onMessage(): Observable<string>,
};

type Subscriber = {
  onConnection(transport: Transport): mixed,
};

export class BigDigServer {
  _logger: log4js$Logger;
  _tagToSubscriber: Map<string, Subscriber>;
  _clientIdToTransport: Map<string, QueuedAckTransport>;
  _useRootCanalCerts: boolean;
  _owners: Array<string>;
  _httpsServer: https.Server;
  _webSocketServer: WS.Server;

  /**
   * Note: The webSocketServer must be running on top of the httpsServer.
   * Note: This BigDigServer is responsible for closing httpServer and wss.
   */
  constructor(
    httpsServer: https.Server,
    webSocketServer: WS.Server,
    useRootCanalCerts: boolean,
  ) {
    this._logger = getLogger('BigDigServer');
    this._tagToSubscriber = new Map();
    this._useRootCanalCerts = useRootCanalCerts;
    this._httpsServer = httpsServer;
    this._httpsServer.on('request', this._onHttpsRequest.bind(this));
    this._httpsServer.on('error', err => {
      this._logger.error('Received error from httpsServer', err);
    });
    this._clientIdToTransport = new Map();
    this._webSocketServer = webSocketServer;
    this._webSocketServer.on(
      'connection',
      this._onWebSocketConnection.bind(this),
    );
    this._webSocketServer.on('error', err => {
      this._logger.error('Received error from webSocketServer', err);
    });
    if (this._useRootCanalCerts) {
      try {
        this._owners = fs
          .readFileSync('/etc/devserver.owners')
          .toString()
          .split('\n');
      } catch (e) {
        this._logger.error('no devserver.owners file found!');
        this._owners = [];
      }
    }
  }

  static async createServer(
    options: BigDigServerOptions,
  ): Promise<BigDigServer> {
    const webServer = https.createServer(options.webServer);

    if (!(await scanPortsToListen(webServer, options.ports))) {
      throw new Error(
        `All ports in range "${options.ports}" are already in use`,
      );
    }

    const webSocketServer = new WS.Server({
      server: webServer,
      perMessageDeflate: true,
    });

    // $FlowIgnore
    const launcher: LauncherType = require(options.absolutePathToServerMain);
    const tunnelLauncher: LauncherType = require('../services/tunnel/launcher');
    const thriftLauncher: LauncherType = require('../services/thrift/launcher');

    const bigDigServer = new BigDigServer(
      webServer,
      webSocketServer,
      options.useRootCanalCerts,
    );

    await launcher(bigDigServer);
    await tunnelLauncher(bigDigServer);
    await thriftLauncher(bigDigServer);

    return bigDigServer;
  }

  addSubscriber(tag: string, subscriber: Subscriber) {
    if (tag === CLOSE_TAG) {
      throw new Error(`Tag ${CLOSE_TAG} is reserved; cannot subscribe.`);
    }

    const existingSubscriber = this._tagToSubscriber.get(tag);
    if (existingSubscriber == null) {
      // TODO(mbolin): WS connections that were created before this subscriber
      // were added will not be able to leverage this subscriber because no
      // InternalTransport was created for it. We should probably add a new
      // entry for all valid tagToTransport maps.
      this._tagToSubscriber.set(tag, subscriber);
    } else {
      throw new Error(`subscriber is already registered for ${tag}`);
    }
  }

  getPort(): number {
    return this._httpsServer.address().port;
  }

  _onHttpsRequest(
    request: http$IncomingMessage,
    response: http$ServerResponse,
  ) {
    if (this._useRootCanalCerts) {
      // $FlowIgnore
      const certObj = request.socket.getPeerCertificate();
      const user = this._extractUserFromCert(certObj);
      if (user == null || !this._checkUserIsOwner(user)) {
        this._logger.error(`invalid user: ${user != null ? user : 'null'}`);
        response.writeHead(401);
        response.end();
        return;
      }
    }

    // catch request's error that might be caused after request ends OK
    // see: https://github.com/nodejs/node/issues/14102
    request.on('error', error => {
      this._logger.error('Received error from https request', error);
    });

    const {pathname} = url.parse(request.url);
    if (request.method === 'POST' && pathname === `/v1/${HEARTBEAT_CHANNEL}`) {
      response.write(getVersion());
      response.end();
      return;
    }
    this._logger.info(
      `Ignored HTTPS ${request.method} request for ${request.url}`,
    );
  }

  _extractUserFromCert(cert: Certificate): ?string {
    const match = cert.subject.CN.match(/user:(.*)\//);
    if (match != null && match.length > 1) {
      return match[1];
    } else {
      return null;
    }
  }

  _checkUserIsOwner(user: string): boolean {
    return this._owners.includes(user);
  }

  _onWebSocketConnection(ws: WS, req: http$IncomingMessage) {
    ws.on('error', err => {
      this._logger.error('Received error from socket', err);
    });

    const {pathname} = url.parse(req.url);
    const clientId = req.headers.client_id;
    this._logger.info(`connection negotiation via path ${String(pathname)}`);
    this._logger.info(`received client_id in header ${clientId}`);

    if (pathname !== '/v1') {
      this._logger.info(`Ignored WSS connection for ${String(pathname)}`);
      return;
    }

    const cachedTransport = this._clientIdToTransport.get(clientId);
    const wsTransport = new WebSocketTransport(clientId, ws);

    if (cachedTransport == null) {
      this._logger.info(`on connection the clientId is ${clientId}`);

      const qaTransport = new QueuedAckTransport(clientId, wsTransport);
      this._clientIdToTransport.set(clientId, qaTransport);

      // Every subscriber must be notified of the new connection because it may
      // want to broadcast messages to it.
      const tagToTransport: Map<string, InternalTransport> = new Map();
      for (const [tag, subscriber] of this._tagToSubscriber) {
        const transport = new InternalTransport(tag, qaTransport);
        this._logger.info(`Created new InternalTransport for ${tag}`);
        tagToTransport.set(tag, transport);
        subscriber.onConnection(transport);
      }

      // subsequent messages will be BigDig messages
      // TODO: could the message be a Buffer?
      // eslint-disable-next-line nuclide-internal/unused-subscription
      qaTransport.onMessage().subscribe(message => {
        this._handleBigDigMessage(tagToTransport, qaTransport, message);
      });

      // TODO: Either garbage collect inactive transports, or implement
      // an explicit "close" action in the big-dig protocol.
    } else {
      invariant(clientId === cachedTransport.id);
      cachedTransport.reconnect(wsTransport);
    }
  }

  _handleBigDigMessage(
    tagToTransport: Map<string, InternalTransport>,
    qaTransport: QueuedAckTransport,
    message: string,
  ) {
    // The message must start with a header identifying its route.
    const index = message.indexOf('\0');
    const tag = message.substring(0, index);

    if (tag === CLOSE_TAG) {
      for (const transport of tagToTransport.values()) {
        transport.close();
      }
      tagToTransport.clear();

      this._clientIdToTransport.delete(qaTransport.id);
      qaTransport.close();
    } else {
      const body = message.substring(index + 1);

      const transport = tagToTransport.get(tag);
      if (transport != null) {
        transport.broadcastMessage(body);
      } else {
        this._logger.info(`No route for ${tag}.`);
      }
    }
  }
}

/**
 * Note that an InternalTransport maintains a reference to a WS connection.
 * It is imperative that it does not leak this reference such that a client
 * holds onto it and prevents it from being garbage-collected after the
 * connection is terminated.
 */
class InternalTransport {
  _messages: Subject<string>;
  _tag: string;
  _transport: QueuedAckTransport;

  constructor(tag: string, ws: QueuedAckTransport) {
    this._messages = new Subject();
    this._tag = tag;
    this._transport = ws;
  }

  send(message: string): void {
    this._transport.send(`${this._tag}\0${message}`);
  }

  onMessage(): Observable<string> {
    // Only expose the subset of the Subject interface that implements
    // Observable.
    return this._messages.asObservable();
  }

  broadcastMessage(message: string): void {
    this._messages.next(message);
  }

  close(): void {
    this._messages.complete();
  }
}
