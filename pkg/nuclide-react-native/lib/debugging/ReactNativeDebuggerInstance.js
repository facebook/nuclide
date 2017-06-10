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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {
  DebuggerInstanceBase,
  DebuggerProcessInfo,
} from '../../../nuclide-debugger-base';
import {DebuggerProxyClient} from './DebuggerProxyClient';
import {Observable} from 'rxjs';
import WS from 'ws';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {Session} from '../../../nuclide-debugger-node-rpc/lib/Session';

const PORT = 38913;

/**
 * This class represents a React Native debugging session in Nuclide. Debugging React Native
 * consists of the following:
 *
 * 1. Hijacking React Native JS execution and performing it in a node process. This is the job of
 *    DebuggerProxyClient.
 * 2. Debugging the node process.
 */
export class ReactNativeDebuggerInstance extends DebuggerInstanceBase {
  _subscriptions: rxjs$ISubscription;
  _connected: Promise<void>;

  constructor(processInfo: DebuggerProcessInfo, debugPort: number) {
    super(processInfo);

    let didConnect;
    this._connected = new Promise(resolve => {
      didConnect = resolve;
    });

    const session$ = uiConnection$
      .combineLatest(pid$)
      .switchMap(([ws, pid]) => createSessionStream(ws, debugPort))
      .publish();

    this._subscriptions = new UniversalDisposable(
      // Tell the user if we can't connect to the debugger UI.
      uiConnection$.subscribe(null, err => {
        atom.notifications.addError('Error connecting to debugger UI.', {
          detail: `Make sure that port ${PORT} is open.`,
          stack: err.stack,
          dismissable: true,
        });

        this.dispose();
      }),
      pid$.first().subscribe(() => {
        didConnect();
      }),
      // Explicitly manage connection.
      uiConnection$.connect(),
      session$.connect(),
      pid$.connect(),
    );
  }

  dispose(): void {
    this._subscriptions.unsubscribe();
  }

  async getWebsocketAddress(): Promise<string> {
    await this._connected;

    // TODO(natthu): Assign random port instead.
    return `ws=localhost:${PORT}/`;
  }
}

/**
 * A stream of PIDs to debug, obtained by connecting to the packager via the DebuggerProxyClient.
 * This stream is shared so that only one client is created when there is more than one subscriber.
 */
const pid$ = Observable.using(
  () => {
    const client = new DebuggerProxyClient();
    client.connect();
    return {
      client,
      unsubscribe: () => {
        client.disconnect();
      },
    };
  },
  ({client}) =>
    observableFromSubscribeFunction(
      client.onDidEvalApplicationScript.bind(client),
    ),
).publish();

/**
 * Connections from the Chrome UI. There will only be one connection at a time. This stream won't
 * complete unless the connection closes.
 */
const uiConnection$ = Observable.using(
  () => {
    // TODO(natthu): Assign random port instead.
    const server = new WS.Server({port: PORT});
    return {
      server,
      unsubscribe: () => {
        server.close();
      },
    };
  },
  ({server}) =>
    Observable.merge(
      Observable.fromEvent(server, 'error').flatMap(Observable.throw),
      Observable.fromEvent(server, 'connection'),
    ).takeUntil(Observable.fromEvent(server, 'close')),
).publish();

function createSessionStream(ws: WS, debugPort: number): Observable<Session> {
  const config = {
    debugPort,
    // This makes the node inspector not load all the source files on startup:
    preload: false,
  };

  return Observable.create(observer => {
    // Creating a new Session is actually side-effecty.
    const session = new Session(config, debugPort, ws);
    observer.next(session);
    return () => {
      session.close();
    };
  });
}
