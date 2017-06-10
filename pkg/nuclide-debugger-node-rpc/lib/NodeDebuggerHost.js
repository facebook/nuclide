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

import {Subject, Observable} from 'rxjs';
import {
  WebSocketServer,
} from '../../nuclide-debugger-common/lib/WebSocketServer';
import {Session} from './Session';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import logger from './utils';

/**
 * Responsible for bootstrap and host node inspector backend.
 */
export class NodeDebuggerHost {
  _subscriptions: UniversalDisposable;
  _nodeSocketServer: WebSocketServer;
  _close$: Subject<mixed>;

  constructor() {
    this._subscriptions = new UniversalDisposable();
    this._nodeSocketServer = new WebSocketServer();
    this._subscriptions.add(this._nodeSocketServer);
    this._close$ = new Subject();
    this._close$.first().subscribe(() => {
      this.dispose();
    });
  }

  start(): string {
    // This is the port that the V8 debugger usually listens on.
    // TODO(natthu): Provide a way to override this in the UI.
    const debugPort = 5858;
    const wsPort = this._generateRandomInteger(2000, 65535);
    this._nodeSocketServer.start(wsPort).then(websocket => {
      logger.debug(`Websocket server created for port: ${wsPort}`);
      // TODO: do we need to add webSocket into CompositeDisposable?
      const config = {
        debugPort,
        preload: false, // This makes the node inspector not load all the source files on startup.
        inject: false, // This causes the node inspector to fail to send an initial pause message
        // on attach.  We don't use this feature, so we turn it off.
      };
      const session = new Session(config, debugPort, websocket);
      Observable.fromEvent(session, 'close').subscribe(this._close$);
    });
    return `ws://127.0.0.1:${wsPort}/`;
  }

  _generateRandomInteger(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }

  onSessionEnd(callback: () => mixed): IDisposable {
    return new UniversalDisposable(this._close$.first().subscribe(callback));
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}
