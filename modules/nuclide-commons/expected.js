/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

/**
 * This is a wrapper type useful for Observables to return errors during its stream
 * and later switch back to regular values if they recover. Normally, a source finishes after
 * passing an uncaught error.
 */
export type Expected<T> =
  | ExpectedError<T>
  | ExpectedValue<T>
  | ExpectedPending<T>;

type ExpectedError<T> = {|
  isError: true,
  isPending: false,
  isValue: false,
  error: Error,
  getOrDefault: (def: T) => T,
  map<U>(fn: (T) => U): Expected<U>,
|};

type ExpectedValue<T> = {|
  isError: false,
  isPending: false,
  isValue: true,
  value: T,
  getOrDefault: (def: T) => T,
  map<U>(fn: (T) => U): Expected<U>,
|};

type ExpectedPending<T> = {|
  isError: false,
  isPending: true,
  isValue: false,
  getOrDefault: (def: T) => T,
  map<U>(fn: (T) => U): Expected<U>,
|};

export class Expect {
  static error<T>(error: Error): ExpectedError<T> {
    return {
      isError: true,
      isPending: false,
      isValue: false,
      error,
      getOrDefault(def: T): T {
        return def;
      },
      map<U>(fn: T => U): Expected<U> {
        return Expect.error(error);
      },
    };
  }

  static value<T>(value: T): ExpectedValue<T> {
    return {
      isError: false,
      isPending: false,
      isValue: true,
      value,
      getOrDefault(def: T): T {
        return this.value;
      },
      map<U>(fn: T => U): Expected<U> {
        return Expect.value(fn(value));
      },
    };
  }

  static pending<T>(): ExpectedPending<T> {
    return {
      isError: false,
      isPending: true,
      isValue: false,
      getOrDefault(def: T): T {
        return def;
      },
      map<U>(fn: T => U): Expected<U> {
        return Expect.pending();
      },
    };
  }
}

export function expectedEqual<T>(
  a: Expected<T>,
  b: Expected<T>,
  valueEqual: (valueA: T, valueB: T) => boolean,
  errorEqual: (errorA: Error, errorB: Error) => boolean,
): boolean {
  if (a.isValue && b.isValue) {
    return valueEqual(a.value, b.value);
  } else if (a.isError && b.isError) {
    return errorEqual(a.error, b.error);
  } else if (a.isPending && b.isPending) {
    return true;
  } else {
    return false;
  }
}
