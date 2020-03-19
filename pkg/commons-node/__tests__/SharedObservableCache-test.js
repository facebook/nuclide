/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 * @emails oncall+nuclide
 */
import {Subject} from 'rxjs';
import SharedObservableCache from '../SharedObservableCache';

describe('SharedObservableCache', () => {
  it('creates and deletes observables on demand', () => {
    const mockObservable = new Subject();
    const mockFactory = jest.fn().mockReturnValue(mockObservable);

    const map = new SharedObservableCache(mockFactory);
    const stream1 = map.get('key');
    const stream2 = map.get('key');

    // The factory doesn't get called until the first subscription.
    expect(mockFactory).not.toHaveBeenCalled();

    const spy1 = jest.fn();
    const spy2 = jest.fn();

    // The first subscription triggers observable creation.
    const sub1 = stream1.subscribe(spy1);
    expect(mockFactory.mock.calls.length).toBe(1);

    // The second subscription shouldn't.
    const sub2 = stream2.subscribe(spy2);
    expect(mockFactory.mock.calls.length).toBe(1);

    mockObservable.next('test');
    expect(spy1).toHaveBeenCalledWith('test');
    expect(spy2).toHaveBeenCalledWith('test');

    sub1.unsubscribe();
    sub2.unsubscribe();

    // Cache should be clear now.
    expect(map._cache.size).toBe(0);

    const sub3 = stream1.subscribe(() => {});
    expect(mockFactory.mock.calls.length).toBe(2);
    sub3.unsubscribe();
  });
});
