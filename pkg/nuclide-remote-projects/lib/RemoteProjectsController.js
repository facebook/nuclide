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

import type {Props as StatusBarTilePropsType} from './StatusBarTile';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {throttle} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import {Observable} from 'rxjs';
import {ServerConnection} from '../../nuclide-remote-connection';
import ConnectionState from './ConnectionState';
import StatusBarTile from './StatusBarTile';

const THROTTLE_TIME_MS = 500;

// Exported for testing.
export function _observeConnectionState(
  connectionStream: Observable<Array<ServerConnection>>,
): Observable<StatusBarTilePropsType> {
  return connectionStream
    .switchMap(
      (
        connections,
      ): Observable<Array<[string, $Values<typeof ConnectionState>]>> => {
        if (connections.length === 0) {
          return Observable.of([]);
        }
        // Observe the connection states of all connections simultaneously.
        // $FlowFixMe: add array signature to combineLatest
        return Observable.combineLatest(
          connections.map(conn => {
            const heartbeat = conn.getHeartbeat();
            return (
              Observable.of(
                heartbeat.isAway()
                  ? ConnectionState.DISCONNECTED
                  : ConnectionState.CONNECTED,
              )
                .concat(
                  Observable.merge(
                    observableFromSubscribeFunction(cb =>
                      heartbeat.onHeartbeat(cb),
                    ).mapTo(ConnectionState.CONNECTED),
                    observableFromSubscribeFunction(cb =>
                      heartbeat.onHeartbeatError(cb),
                    ).mapTo(ConnectionState.DISCONNECTED),
                  ),
                )
                .distinctUntilChanged()
                // Key the connection states by hostname.
                .map(state => [conn.getRemoteHostname(), state])
            );
          }),
        );
      },
    )
    .map(states => ({
      connectionStates: new Map(states),
    }));
}

export default class RemoteProjectsController {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
  }

  consumeStatusBar(statusBar: atom$StatusBar): IDisposable {
    const BoundStatusBarTile = bindObservableAsProps(
      _observeConnectionState(ServerConnection.observeRemoteConnections()).let(
        throttle(THROTTLE_TIME_MS),
      ),
      StatusBarTile,
    );
    const item = renderReactRoot(<BoundStatusBarTile />);
    item.className = 'inline-block';
    const statusBarTile = statusBar.addLeftTile({
      item,
      priority: -99,
    });
    const disposable = new UniversalDisposable(() => statusBarTile.destroy());
    this._disposables.add(disposable);
    return new UniversalDisposable(() => {
      this._disposables.remove(disposable);
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
