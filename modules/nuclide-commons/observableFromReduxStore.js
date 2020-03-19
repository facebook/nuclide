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

import {Observable} from 'rxjs';
import {observableFromSubscribeFunction} from './event';

type Store<S> = {
  getState(): S,
  subscribe(listener: () => void): () => void,
};

/*
 * Use this rather than Observable.from(store). While Redux properly implements
 * `Symbol.observable`, Flow doesn't know about it, and `Symbol.observable` requires
 * a polyfill that RxJS no longer provides.
 *
 * Matches the behavioral differences between Redux's vanilla `subscribe` and
 * its `Symbol.observable` implementation: yield the store's state to subscribers,
 * and emit on the initial subscription.
 */
export default function observableFromReduxStore<S>(
  store: Store<S>,
): Observable<S> {
  return observableFromSubscribeFunction(store.subscribe)
    .startWith(null) // emit the current state on subscribe
    .map(() => store.getState());
}
