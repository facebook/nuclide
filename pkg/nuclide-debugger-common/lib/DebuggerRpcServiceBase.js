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

import type {ConnectableObservable} from 'rxjs';
import type {AtomNotification} from '../../nuclide-debugger-base/lib/types';

import WS from 'ws';
import ClientCallback from './ClientCallback';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getLogger} from 'log4js';

export class DebuggerRpcServiceBase {
  _clientCallback: ClientCallback;
  _logger: log4js$Logger;
  _subscriptions: UniversalDisposable;

  constructor(debuggerRpcServiceName: string) {
    this._clientCallback = new ClientCallback();
    this._logger = getLogger(`nuclide-debugger-${debuggerRpcServiceName}-rpc`);
    this._subscriptions = new UniversalDisposable(this._clientCallback);
  }

  getClientCallback(): ClientCallback {
    return this._clientCallback;
  }

  getLogger(): log4js$Logger {
    return this._logger;
  }

  getSubscriptions(): UniversalDisposable {
    return this._subscriptions;
  }

  getOutputWindowObservable(): ConnectableObservable<string> {
    return this._clientCallback.getOutputWindowObservable().publish();
  }

  getAtomNotificationObservable(): ConnectableObservable<AtomNotification> {
    return this._clientCallback.getAtomNotificationObservable().publish();
  }

  getServerMessageObservable(): ConnectableObservable<string> {
    return this._clientCallback.getServerMessageObservable().publish();
  }

  dispose(): Promise<void> {
    this._subscriptions.dispose();
    return Promise.resolve();
  }
}

// TODO: make this transportation plugable.
/**
 * Debugger base rpc service using WebSocket protocol to communicate with backend.
 */
export class DebuggerRpcWebSocketService extends DebuggerRpcServiceBase {
  _webSocket: ?WS;

  async connectToWebSocketServer(
    webSocketServerAddress: string,
  ): Promise<void> {
    const webSocket = await this._startWebSocketClient(webSocketServerAddress);
    this._webSocket = webSocket;
    this._subscriptions.add(() => webSocket.terminate());
    webSocket.on('message', this._handleWebSocketServerMessage.bind(this));
  }

  getWebSocket(): ?WS {
    return this._webSocket;
  }

  _handleWebSocketServerMessage(message: string): void {
    this._clientCallback.sendChromeMessage(message);
  }

  _startWebSocketClient(webSocketServerAddress: string): Promise<WS> {
    return new Promise((resolve, reject) => {
      const ws = new WS(webSocketServerAddress);
      ws.on('open', () => {
        // Successfully connected with WS server, fulfill the promise.
        resolve(ws);
      });
      ws.on('error', (error: Error) => {
        reject(error);
        this.dispose();
      });
      ws.on('close', (code: number, reason: string) => {
        const message = `WebSocket closed with: ${code}, ${reason}`;
        reject(Error(message));
        this.dispose();
      });
    });
  }

  sendCommand(message: string): Promise<void> {
    const webSocket = this._webSocket;
    if (webSocket != null) {
      this.getLogger().trace(`forward client message to server: ${message}`);
      webSocket.send(message);
    } else {
      this.getLogger().info(
        `Nuclide sent message to server after socket closed: ${message}`,
      );
    }
    return Promise.resolve();
  }
}
