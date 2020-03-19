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

import UniversalDisposable from './UniversalDisposable';
import {Observable} from 'rxjs';

/**
 * Add an event listener an return a disposable for removing it. Note that this function assumes
 * node EventEmitter semantics: namely, that adding the same combination of eventName and callback
 * adds a second listener.
 */
export function attachEvent(
  emitter: events$EventEmitter,
  eventName: string,
  callback: Function,
): IDisposable {
  emitter.addListener(eventName, callback);
  return new UniversalDisposable(() => {
    emitter.removeListener(eventName, callback);
  });
}

type SubscribeCallback<T> = (item: T) => any;
type SubscribeFunction<T> = (
  callback: SubscribeCallback<T>,
) => IDisposable | (() => mixed);

export function observableFromSubscribeFunction<T>(
  fn: SubscribeFunction<T>,
): Observable<T> {
  return Observable.create(
    observer => new UniversalDisposable(fn(observer.next.bind(observer))),
  );
}
