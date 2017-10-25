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

import type {Observable} from 'rxjs';
import type WS from 'ws';
import type https from 'https';

import {getLogger} from 'log4js';
import url from 'url';
import {Subject} from 'rxjs';

export type Transport = {
  send(message: string): void,
  onMessage(): Observable<string>,
};

type Subscriber = {
  onConnection(transport: Transport): mixed,
};

export default class BigDigServer {
  _logger: log4js$Logger;
  _tagToSubscriber: Map<string, Subscriber>;

  /**
   * Currently, this is unused, though we will likely use it once we port the
   * logic for XhrConnectionHeartbeat over.
   */
  _httpsServer: https.Server;
  _webSocketServer: WS.Server;

  /**
   * Note: The webSocketServer must be running on top of the httpsServer.
   * Note: This BigDigServer is responsible for closing httpServer and wss.
   */
  constructor(httpsServer: https.Server, webSocketServer: WS.Server) {
    this._logger = getLogger();
    this._tagToSubscriber = new Map();
    this._httpsServer = httpsServer;
    this._httpsServer.on('request', this._onHttpsRequest.bind(this));
    this._webSocketServer = webSocketServer;
    this._webSocketServer.on(
      'connection',
      this._onWebSocketConnection.bind(this),
    );
  }

  addSubscriber(tag: string, subscriber: Subscriber) {
    const existingSubscriber = this._tagToSubscriber.get(tag);
    if (existingSubscriber == null) {
      // TODO(mbolin): WS connections that were created before this subscriber
      // were added will not be able to leverage this subscriber because no
      // InternalTransport was created for it. We should probably add a new
      // entry for all valid tagToTransport maps.
      this._tagToSubscriber.set(tag, subscriber);
    } else {
      throw Error(`subscriber is already registered for ${tag}`);
    }
  }

  _onHttpsRequest(
    request: http$IncomingMessage,
    response: http$ServerResponse,
  ) {
    this._logger.info(`Ignored HTTPS request for ${request.url}`);
  }

  _onWebSocketConnection(ws: WS, req: http$IncomingMessage) {
    // Note that in ws@3.0.0, the upgradeReq property of ws has been removed:
    // it is passed as the second argument to this callback instead.
    const {pathname} = url.parse(req.url);
    if (pathname !== '/v1') {
      this._logger.info(`Ignored WSS connection for ${String(pathname)}`);
      return;
    }

    // Every subscriber must be notified of the new connection because it may
    // want to broadcast messages to it.
    const tagToTransport: Map<string, InternalTransport> = new Map();
    for (const [tag, subscriber] of this._tagToSubscriber) {
      const transport = new InternalTransport(tag, ws);
      this._logger.info(`Created new InternalTransport for ${tag}`);
      tagToTransport.set(tag, transport);
      subscriber.onConnection(transport);
    }

    // Is message a string or could it be a Buffer?
    ws.on('message', message => {
      // The message must start with a header identifying its route.
      const index = message.indexOf('\0');
      const tag = message.substring(0, index);
      const body = message.substring(index + 1);

      const transport = tagToTransport.get(tag);
      if (transport != null) {
        transport.broadcastMessage(body);
      } else {
        this._logger.info(`No route for ${tag}.`);
      }
    });

    // TODO(mbolin): When ws disconnects, do we explicitly have to clear out
    // tagToTransport? It seems like it should get garbage-collected
    // automatically, assuming this._webSocketServer no longer has a reference
    // to ws. But we should probably call InternalTransport.close() on all of
    // the entries in tagToTransport?
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
  _ws: WS;

  constructor(tag: string, ws: WS) {
    this._messages = new Subject();
    this._tag = tag;
    this._ws = ws;
  }

  send(message: string): void {
    this._ws.send(`${this._tag}\0${message}`);
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
