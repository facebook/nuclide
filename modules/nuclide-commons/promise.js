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

import invariant from 'assert';

type RunReturn<T> =
  | {
      status: 'success',
      result: T,
    }
  | {
      status: 'outdated',
    };

/**
 * Allows a caller to ensure that the results it receives from consecutive
 * promise resolutions are never outdated. Usage:
 *
 * var requestSerializer = new RequestSerializer();
 *
 * // in some later loop:
 *
 * // note that you do not await the async function here -- you must pass the
 * // promise it returns to `run`
 * var result = await requestSerializer.run(someAsyncFunction())
 *
 * if (result.status === 'success') {
 *   ....
 *   result.result
 * } else if (result.status === 'outdated') {
 *   ....
 * }
 *
 * The contract is that the status is 'success' if and only if this was the most
 * recently dispatched call of 'run'. For example, if you call run(promise1) and
 * then run(promise2), and promise2 resolves first, the second callsite would
 * receive a 'success' status. If promise1 later resolved, the first callsite
 * would receive an 'outdated' status.
 */
export class RequestSerializer<T> {
  _lastDispatchedOp: number;
  _lastFinishedOp: number;
  _latestPromise: Promise<T>;
  _waitResolve: Function;

  constructor() {
    this._lastDispatchedOp = 0;
    this._lastFinishedOp = 0;
    this._latestPromise = new Promise((resolve, reject) => {
      this._waitResolve = resolve;
    });
  }

  async run(promise: Promise<T>): Promise<RunReturn<T>> {
    const thisOp = this._lastDispatchedOp + 1;
    this._lastDispatchedOp = thisOp;
    this._latestPromise = promise;
    this._waitResolve();
    const result = await promise;
    if (this._lastFinishedOp < thisOp) {
      this._lastFinishedOp = thisOp;
      return {
        status: 'success',
        result,
      };
    } else {
      return {
        status: 'outdated',
      };
    }
  }

  /**
   * Returns a Promise that resolves to the last result of `run`,
   * as soon as there are no more outstanding `run` calls.
   */
  async waitForLatestResult(): Promise<T> {
    let lastPromise = null;
    let result: any = null;
    while (lastPromise !== this._latestPromise) {
      lastPromise = this._latestPromise;
      // Wait for the current last know promise to resolve, or a next run have started.
      // eslint-disable-next-line no-await-in-loop
      result = await new Promise((resolve, reject) => {
        this._waitResolve = resolve;
        this._latestPromise.then(resolve);
      });
    }
    return (result: T);
  }

  isRunInProgress(): boolean {
    return this._lastDispatchedOp > this._lastFinishedOp;
  }
}

/*
 * Returns a promise that will resolve after `milliSeconds` milli seconds.
 * this can be used to pause execution asynchronously.
 * e.g. await sleep(1000), pauses the async flow execution for 1 second.
 */
export function sleep(milliSeconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliSeconds);
  });
}

export function nextTick(): Promise<void> {
  return new Promise(resolve => {
    process.nextTick(resolve);
  });
}

/**
 * Executes a provided callback only if a promise takes longer than
 * `milliSeconds` milliseconds to resolve.
 *
 * @param `promise` the promise to wait on.
 * @param `milliSeconds` max amount of time that `promise` can take to resolve
 * before timeoutFn is fired.
 * @param `timeoutFn` the function to execute when a promise takes longer than
 * `milliSeconds` ms to resolve.
 * @param `cleanupFn` the cleanup function to execute after the promise resolves.
 */
export async function triggerAfterWait<T>(
  promise: Promise<T>,
  milliSeconds: number,
  timeoutFn: () => void,
  cleanupFn?: () => void,
): Promise<T> {
  const timeout = setTimeout(timeoutFn, milliSeconds);
  try {
    return await promise;
  } finally {
    clearTimeout(timeout);
    if (cleanupFn) {
      cleanupFn();
    }
  }
}

/**
 * Thrown by `timeoutPromise` if the timer fires before the promise resolves/rejects.
 */
export class TimedOutError extends Error {
  timeout: number;
  constructor(milliseconds: number) {
    super(`Timed out after ${String(milliseconds)} ms`);
    this.timeout = milliseconds;
  }
}

/**
 * Returns a Promise that resolves to the same value as the given promise, or rejects with
 * `TimedOutError` if it takes longer than `milliseconds` milliseconds.
 */
export function timeoutPromise<T>(
  promise: Promise<T>,
  milliseconds: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      timeout = null;
      reject(new TimedOutError(milliseconds));
      // This gives useless error.stack results.
      // We could capture the stack pre-emptively at the start
      // of this method if we wanted useful ones.
    }, milliseconds);
    promise
      .then(value => {
        if (timeout != null) {
          clearTimeout(timeout);
        }
        resolve(value);
      })
      .catch(value => {
        if (timeout != null) {
          clearTimeout(timeout);
        }
        reject(value);
      });
  });
}

// An DeadlineRequest parameter to an async method is a way of *requesting* that
// method to throw a TimedOutError if it doesn't complete in a certain time.
// It's just a request -- the async method will typically honor the request
// by passing the parameter on to ALL subsidiary async methods that it awaits,
// or by calling expirePromise to enforce a timeout, or similar.
//
// In cases where a method supports DeadlineRequest but you don't trust it, do
// `await timeoutAfterDeadline(deadline, untrusted.foo(deadline-1000))` so you
// ask it nicely but if it doesn't give its own more-specific deadline message
// within a 1000ms grace period then you force matters.
//
// Under the hood an DeadlineRequest is just a timestamp of the time by which
// the operation should complete. This makes it compositional (better than
// "delay" parameters) and safely remotable (better than "CancellationToken"
// parameters) so long as clocks are in sync. In all other respects it's less
// versatile than CancellationTokens.
export type DeadlineRequest = number;

export function createDeadline(delay: number): DeadlineRequest {
  return Date.now() + delay;
}

export function timeoutAfterDeadline<T>(
  deadline: DeadlineRequest,
  promise: Promise<T>,
): Promise<T> {
  const delay = deadline - Date.now();
  return timeoutPromise(promise, delay < 0 ? 0 : delay);
}

/**
 * Call an async function repeatedly with a maximum number of trials limit,
 * until a valid result that's defined by a validation function.
 * A failed call can result from an async thrown exception, or invalid result.
 *
 * @param `retryFunction` the async logic that's wanted to be retried.
 * @param `validationFunction` the validation function that decides whether a response is valid.
 * @param `maximumTries` the number of times the `retryFunction` can fail to get a valid
 * response before the `retryLimit` is terminated reporting an error.
 * @param `retryIntervalMs` optional, the number of milliseconds to wait between trials, if wanted.
 *
 * If an exception is encountered on the last trial, the exception is thrown.
 * If no valid response is found, an exception is thrown.
 */
export async function retryLimit<T>(
  retryFunction: () => Promise<T>,
  validationFunction: (result: T) => boolean,
  maximumTries: number,
  retryIntervalMs?: number = 0,
): Promise<T> {
  let result = null;
  let tries = 0;
  let lastError = null;
  while (tries === 0 || tries < maximumTries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await retryFunction();
      lastError = null;
      if (validationFunction(result)) {
        return result;
      }
    } catch (error) {
      lastError = error;
      result = null;
    }

    if (++tries < maximumTries && retryIntervalMs !== 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(retryIntervalMs);
    }
  }
  if (lastError != null) {
    throw lastError;
  } else if (tries === maximumTries) {
    throw new Error('No valid response found!');
  } else {
    return ((result: any): T);
  }
}

/**
 * Limits async function execution parallelism to only one at a time.
 * Hence, if a call is already running, it will wait for it to finish,
 * then start the next async execution, but if called again while not finished,
 * it will return the scheduled execution promise.
 *
 * Sample Usage:
 * ```
 * let i = 1;
 * const oneExecAtATime = oneParallelAsyncCall(() => {
 *   return next Promise((resolve, reject) => {
 *     setTimeout(200, () => resolve(i++));
 *   });
 * });
 *
 * const result1Promise = oneExecAtATime(); // Start an async, and resolve to 1 in 200 ms.
 * const result2Promise = oneExecAtATime(); // Schedule the next async, and resolve to 2 in 400 ms.
 * const result3Promise = oneExecAtATime(); // Reuse scheduled promise and resolve to 2 in 400 ms.
 * ```
 */
export function serializeAsyncCall<T>(
  asyncFun: () => Promise<T>,
): () => Promise<T> {
  let scheduledCall = null;
  let pendingCall = null;
  const startAsyncCall = () => {
    const resultPromise = asyncFun();
    pendingCall = resultPromise.then(
      () => (pendingCall = null),
      () => (pendingCall = null),
    );
    return resultPromise;
  };
  const callNext = () => {
    scheduledCall = null;
    return startAsyncCall();
  };
  const scheduleNextCall = () => {
    if (scheduledCall == null) {
      invariant(pendingCall, 'pendingCall must not be null!');
      scheduledCall = pendingCall.then(callNext, callNext);
    }
    return scheduledCall;
  };
  return () => {
    if (pendingCall == null) {
      return startAsyncCall();
    } else {
      return scheduleNextCall();
    }
  };
}

/**
 * Provides a promise along with methods to change its state. Our version of the non-standard
 * `Promise.defer()`.
 *
 * IMPORTANT: This should almost never be used!! Instead, use the Promise constructor. See
 *  <https://github.com/petkaantonov/bluebird/wiki/Promise-anti-patterns#the-deferred-anti-pattern>
 */
export class Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

/**
 * Returns a value derived asynchronously from an element in the items array.
 * The test function is applied sequentially to each element in items until
 * one returns a Promise that resolves to a non-null value. When this happens,
 * the Promise returned by this method will resolve to that non-null value. If
 * no such Promise is produced, then the Promise returned by this function
 * will resolve to null.
 *
 * @param items Array of elements that will be passed to test, one at a time.
 * @param test Will be called with each item and must return either:
 *     (1) A "thenable" (i.e, a Promise or promise-like object) that resolves
 *         to a derived value (that will be returned) or null.
 *     (2) null.
 *     In both cases where null is returned, test will be applied to the next
 *     item in the array.
 * @param thisArg Receiver that will be used when test is called.
 * @return Promise that resolves to an asynchronously derived value or null.
 */
export function asyncFind<T, U>(
  items_: Array<T>,
  test: (t: T) => ?Promise<?U>,
  thisArg?: mixed,
): Promise<?U> {
  let items = items_;
  return new Promise((resolve, reject) => {
    // Create a local copy of items to defend against the caller modifying the
    // array before this Promise is resolved.
    items = items.slice();
    const numItems = items.length;

    const next = async function(index) {
      if (index === numItems) {
        resolve(null);
        return;
      }

      const item = items[index];
      const result = await test.call(thisArg, item);
      if (result != null) {
        resolve(result);
      } else {
        next(index + 1);
      }
    };

    next(0);
  });
}

export function denodeify(
  f: (...args: Array<any>) => any,
): (...args: Array<any>) => Promise<any> {
  return function(...args: Array<any>) {
    return new Promise((resolve, reject) => {
      function callback(error, result) {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
      f.apply(this, args.concat([callback]));
    });
  };
}

/**
 * A Promise utility that runs a maximum of limit async operations at a time
 * iterating over an array and returning the result of executions.
 * e.g. to limit the number of file reads to 5,
 * replace the code:
 *    var fileContents = await Promise.all(filePaths.map(fsPromise.readFile))
 * with:
 *    var fileContents = await asyncLimit(filePaths, 5, fsPromise.readFile)
 *
 * This is particulrily useful to limit IO operations to a configurable maximum (to avoid
 * blocking), while enjoying the configured level of parallelism.
 *
 * @param array the array of items for iteration.
 * @param limit the configurable number of parallel async operations.
 * @param mappingFunction the async Promise function that could return a useful result.
 */
export function asyncLimit<T, V>(
  array: Array<T>,
  limit: number,
  mappingFunction: (item: T) => Promise<V>,
): Promise<Array<V>> {
  const result: Array<V> = new Array(array.length);
  let parallelPromises = 0;
  let index = 0;

  let parallelLimit = Math.min(limit, array.length) || 1;

  return new Promise((resolve, reject) => {
    const runPromise = async () => {
      if (index === array.length) {
        if (parallelPromises === 0) {
          resolve(result);
        }
        return;
      }
      ++parallelPromises;
      const i = index++;
      try {
        result[i] = await mappingFunction(array[i]);
      } catch (e) {
        reject(e);
      }
      --parallelPromises;
      runPromise();
    };

    while (parallelLimit--) {
      runPromise();
    }
  });
}

/**
 * `filter` Promise utility that allows filtering an array with an async Promise function.
 * It's an alternative to `Array.prototype.filter` that accepts an async function.
 * You can optionally configure a limit to set the maximum number of async operations at a time.
 *
 * Previously, with the `Promise.all` primitive, we can't set the parallelism limit and we have to
 * `filter`, so, we replace the old `filter` code:
 *     var existingFilePaths = [];
 *     await Promise.all(filePaths.map(async (filePath) => {
 *       if (await fsPromise.exists(filePath)) {
 *         existingFilePaths.push(filePath);
 *       }
 *     }));
 * with limit 5 parallel filesystem operations at a time:
 *    var existingFilePaths = await asyncFilter(filePaths, fsPromise.exists, 5);
 *
 * @param array the array of items for `filter`ing.
 * @param filterFunction the async `filter` function that returns a Promise that resolves to a
 *   boolean.
 * @param limit the configurable number of parallel async operations.
 */
export async function asyncFilter<T>(
  array: Array<T>,
  filterFunction: (item: T) => Promise<boolean>,
  limit?: number,
): Promise<Array<T>> {
  const filteredList = [];
  // flowlint-next-line sketchy-null-number:off
  await asyncLimit(array, limit || array.length, async (item: T) => {
    if (await filterFunction(item)) {
      filteredList.push(item);
    }
  });
  return filteredList;
}

export async function asyncObjFilter<T>(
  obj: {[key: string]: T},
  filterFunction: (item: T, key: string) => Promise<boolean>,
  limit?: number,
): Promise<{[key: string]: T}> {
  const keys = Object.keys(obj);
  const filteredObj = {};
  // flowlint-next-line sketchy-null-number:off
  await asyncLimit(keys, limit || keys.length, async (key: string) => {
    const item = obj[key];
    if (await filterFunction(item, key)) {
      filteredObj[key] = item;
    }
  });
  return filteredObj;
}

/**
 * `some` Promise utility that allows `some` an array with an async Promise some function.
 * It's an alternative to `Array.prototype.some` that accepts an async some function.
 * You can optionally configure a limit to set the maximum number of async operations at a time.
 *
 * Previously, with the Promise.all primitive, we can't set the parallelism limit and we have to
 * `some`, so, we replace the old `some` code:
 *     var someFileExist = false;
 *     await Promise.all(filePaths.map(async (filePath) => {
 *       if (await fsPromise.exists(filePath)) {
 *         someFileExist = true;
 *       }
 *     }));
 * with limit 5 parallel filesystem operations at a time:
 *    var someFileExist = await asyncSome(filePaths, fsPromise.exists, 5);
 *
 * @param array the array of items for `some`ing.
 * @param someFunction the async `some` function that returns a Promise that resolves to a
 *   boolean.
 * @param limit the configurable number of parallel async operations.
 */
export async function asyncSome<T>(
  array: Array<T>,
  someFunction: (item: T) => Promise<boolean>,
  limit?: number,
): Promise<boolean> {
  let resolved = false;
  // flowlint-next-line sketchy-null-number:off
  await asyncLimit(array, limit || array.length, async (item: T) => {
    if (resolved) {
      // We don't need to call the someFunction anymore or wait any longer.
      return;
    }
    if (await someFunction(item)) {
      resolved = true;
    }
  });
  return resolved;
}

/**
 * Check if an object is Promise by testing if it has a `then` function property.
 */
export function isPromise(object: any): boolean {
  return (
    Boolean(object) &&
    typeof object === 'object' &&
    typeof object.then === 'function'
  );
}

/**
 * We can't name a function 'finally', so use lastly instead.
 * fn() will be executed (and completed) after the provided promise resolves/rejects.
 */
export function lastly<T>(
  promise: Promise<T>,
  fn: () => Promise<mixed> | mixed,
): Promise<T> {
  return promise.then(
    ret => {
      return Promise.resolve(fn()).then(() => ret);
    },
    err => {
      return Promise.resolve(fn()).then(() => Promise.reject(err));
    },
  );
}

/**
 * With a pure promise object, there's no way to tell synchronously
 * whether or not it has 'settled' (i.e. been fulfilled or rejected).
 * Here we provide a wrapper that provides that information.
 */
export type PromiseState<T> =
  | {kind: 'pending'}
  | {kind: 'fulfilled', value: T}
  | {kind: 'rejected', error: any};

export class PromiseWithState<T> {
  _promise: Promise<T>;
  _state: PromiseState<T>;

  constructor(promise: Promise<T>) {
    this._state = {kind: 'pending'};
    this._promise = promise.then(
      value => {
        this._state = {kind: 'fulfilled', value};
        return value;
      },
      error => {
        this._state = {kind: 'rejected', error};
        throw error;
      },
    );
  }

  getPromise(): Promise<T> {
    return this._promise;
  }

  getState(): PromiseState<T> {
    return this._state;
  }
}

export function delayTime(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}
