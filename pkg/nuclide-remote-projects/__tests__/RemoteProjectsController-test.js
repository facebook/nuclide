/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {BehaviorSubject} from 'rxjs';
import ConnectionState from '../lib/ConnectionState';
import {_observeConnectionState} from '../lib/RemoteProjectsController';

class MockHeartbeat {
  away: BehaviorSubject<boolean> = new BehaviorSubject(false);
  isAway() {
    return this.away.getValue();
  }

  onHeartbeat(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this.away.filter(x => !x).subscribe(callback),
    );
  }

  onHeartbeatError(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this.away.filter(x => x).subscribe(callback),
    );
  }
}

describe('_observeConnectionState', () => {
  it('reflects the state of all connections', () => {
    const connectionSubject = new BehaviorSubject([]);
    const propStream = [];
    _observeConnectionState(connectionSubject).subscribe(props =>
      propStream.push(props),
    );

    const heartbeat1 = new MockHeartbeat();
    const connection1: any = {
      getRemoteHostname: () => 'host1',
      getHeartbeat: () => heartbeat1,
    };
    connectionSubject.next([connection1]);

    const heartbeat2 = new MockHeartbeat();
    const connection2: any = {
      getRemoteHostname: () => 'host2',
      getHeartbeat: () => heartbeat2,
    };
    connectionSubject.next([connection1, connection2]);

    heartbeat1.away.next(true);
    heartbeat2.away.next(true);
    heartbeat2.away.next(false);

    connectionSubject.next([]);

    expect(propStream).toEqual([
      {connectionStates: new Map()},
      {connectionStates: new Map([['host1', ConnectionState.CONNECTED]])},
      {
        connectionStates: new Map([
          ['host1', ConnectionState.CONNECTED],
          ['host2', ConnectionState.CONNECTED],
        ]),
      },
      {
        connectionStates: new Map([
          ['host1', ConnectionState.DISCONNECTED],
          ['host2', ConnectionState.CONNECTED],
        ]),
      },
      {
        connectionStates: new Map([
          ['host1', ConnectionState.DISCONNECTED],
          ['host2', ConnectionState.DISCONNECTED],
        ]),
      },
      {
        connectionStates: new Map([
          ['host1', ConnectionState.DISCONNECTED],
          ['host2', ConnectionState.CONNECTED],
        ]),
      },
      {connectionStates: new Map()},
    ]);
  });
});
