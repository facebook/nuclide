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

type ExpectedError<T> = {
  isError: true,
  error: Error,
  getOrDefault: (def: T) => T,
};

type ExpectedValue<T> = {
  isError: false,
  value: T,
  getOrDefault: (def: T) => T,
};

export type Expected<T> = ExpectedError<T> | ExpectedValue<T>;

export class Expect {
  static error<T>(error: Error): ExpectedError<T> {
    return {
      isError: true,
      error,
      getOrDefault(def: T): T {
        return def;
      },
    };
  }

  static value<T>(value: T): ExpectedValue<T> {
    return {
      isError: false,
      value,
      getOrDefault(def: T): T {
        return this.value;
      },
    };
  }
}
