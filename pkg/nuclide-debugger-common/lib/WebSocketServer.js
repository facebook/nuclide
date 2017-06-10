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

import WS from 'ws';
import EventEmitter from 'events';

export class WebSocketServer {
  _webSocketServer: ?WS.Server;
  _eventEmitter: EventEmitter;

  constructor() {
    this._webSocketServer = null;
    this._eventEmitter = new EventEmitter();
  }

  // Promise only resolves when one WebSocket client connect to it.
  start(port: number): Promise<WS> {
    return new Promise((resolve, reject) => {
      const server = new WS.Server({port});
      this._webSocketServer = server;
      server.on('error', error => {
        reject(error);
      });
      server.once('connection', webSocket => {
        resolve(webSocket);
      });
    });
  }

  dispose(): void {
    if (this._webSocketServer != null) {
      this._webSocketServer.close();
    }
  }
}
