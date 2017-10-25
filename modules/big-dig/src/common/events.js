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

import {lastly, Deferred} from 'nuclide-commons/promise';

type EventOnce<E, T> = {
  +once: (event: E, listener: (arg: T) => mixed) => mixed,
};

type EventOnceOrError<E, T> = {
  +once: ((event: E, listener: (arg: T) => mixed) => mixed) &
    ((event: 'error', listener: (arg: Error) => mixed) => mixed),
  +removeListener: ((event: E, listener: (arg: T) => mixed) => mixed) &
    ((event: 'error', listener: (arg: Error) => mixed) => mixed),
};

type EventOnceArray<E, T: Array<any>> = {
  +once: (event: E, listener: (...args: T) => mixed) => mixed,
};

/**
 * Creates a promise to await a single firing of `event` from `emitter`. This function only returns
 * the first argument from the event.
 */
export function onceEvent<E, T>(
  emitter: EventOnce<E, T>,
  event: E,
): Promise<T> {
  return new Promise(resolve => {
    emitter.once(event, resolve);
  });
}

/**
 * Creates a promise to await a single firing of `event` from `emitter`. This function only returns
 * the first argument from the event.
 */
export function onceEventOrError<E, T>(
  emitter: EventOnceOrError<E, T>,
  event: E,
): Promise<T> {
  const {promise, resolve, reject} = new Deferred();
  emitter.once(event, resolve);
  emitter.once('error', reject);
  return lastly(promise, () => {
    emitter.removeListener(event, resolve);
    emitter.removeListener('error', reject);
  });
}

/**
 * Creates a promise to await a single firing of `event` from `emitter`. This function returns an
 * array of all arguments from the event.
 */
export function onceEventArray<E, T: Array<any>>(
  emitter: EventOnceArray<E, T>,
  event: E,
): Promise<T> {
  return new Promise(resolve => {
    emitter.once(event, (...args) => resolve(args));
  });
}
