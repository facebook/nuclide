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

export class Cache<T> {
  store: Map<string, T> = new Map();

  getOrCreate(key: string, callback: () => T): T {
    let cached = this.store.get(key);
    if (cached === undefined) {
      cached = callback();
      this.store.set(key, cached);
    }
    return cached;
  }
}

export function createCache<T>(): Cache<T> {
  return new Cache();
}
