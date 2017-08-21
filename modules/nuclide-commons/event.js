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

import {Disposable} from 'event-kit';
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
): Disposable {
  emitter.addListener(eventName, callback);
  return new Disposable(() => {
    emitter.removeListener(eventName, callback);
  });
}

type SubscribeCallback<T> = (item: T) => any;
type SubscribeFunction<T> = (callback: SubscribeCallback<T>) => IDisposable;

export function observableFromSubscribeFunction<T>(
  fn: SubscribeFunction<T>,
): Observable<T> {
  return Observable.create(observer => {
    const disposable = fn(observer.next.bind(observer));
    return () => {
      disposable.dispose();
    };
  });
}
