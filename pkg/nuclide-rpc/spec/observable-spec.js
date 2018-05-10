/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import {Observable} from 'rxjs';

describe('ConnectableObservable', () => {
  it('connect', () => {
    let created = 0;
    let unsubscribed = 0;
    const obs = Observable.create(observer => {
      created += 1;
      return {
        unsubscribe: () => {
          unsubscribed += 1;
        },
      };
    });
    const connectable = obs.publish();
    const subscription = connectable.subscribe(() => {});

    // Underlying subscribe happens on connect, not on subscribe
    expect(created).toBe(0);
    const connection = connectable.connect();
    expect(created).toBe(1);

    // Underlying unsubscribe happens when connection is unsubscribed,
    // not when subscription is unsubscribed.
    subscription.unsubscribe();
    expect(unsubscribed).toBe(0);
    connection.unsubscribe();
    expect(unsubscribed).toBe(1);

    // NOTE: Can reconnect, which results in a resubscribe of the underlying
    expect(created).toBe(1);
    const connection2 = connectable.connect();
    expect(created).toBe(2);
    // But multiple simultaneous connections are shared.
    const connection3 = connectable.connect();
    expect(created).toBe(2);

    // First disconnect closes the connection
    expect(unsubscribed).toBe(1);
    connection3.unsubscribe();
    expect(unsubscribed).toBe(2);
    const subscription2 = connectable.subscribe(() => {});
    subscription2.unsubscribe();
    expect(unsubscribed).toBe(2);
    connection2.unsubscribe();
    expect(unsubscribed).toBe(2);
    expect(created).toBe(2);
  });

  it('refcount', () => {
    let created = 0;
    let unsubscribed = 0;
    const obs = Observable.create(observer => {
      created += 1;
      return {
        unsubscribe: () => {
          unsubscribed += 1;
        },
      };
    });
    const connectable = obs.publish();

    // Getting the refCount() observable does not connect
    expect(created).toBe(0);
    const refCountObservable = connectable.refCount();

    // Subscribing to a refCount() observable connects
    expect(created).toBe(0);
    const refcount = refCountObservable.subscribe();
    expect(created).toBe(1);
    // And the connection is shared.
    const refcount2 = connectable.refCount().subscribe();
    const refcount3 = refCountObservable.subscribe();
    expect(created).toBe(1);

    // Disconnect happens once all refCount() observables are unsubscribed from.
    expect(unsubscribed).toBe(0);
    refcount2.unsubscribe();
    expect(unsubscribed).toBe(0);
    refcount.unsubscribe();
    expect(unsubscribed).toBe(0);
    refcount3.unsubscribe();
    expect(unsubscribed).toBe(1);
  });

  // TODO: Test disconnect when a subscription is outstanding.
});
