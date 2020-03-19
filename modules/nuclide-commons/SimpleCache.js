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

// TODO: Merge this class with nuclide-commons/cache.js because they probably do
//   very similar things

/**
 * Tiny class that is useful to cache simple values.
 * It's quite useful for promises with a SimpleCache<Promise<T>> which allows reusing the same promise.
 */

type DisposeCallback<T> = (value: T) => void;
type KeyFactory<KeyArgs> = (args: KeyArgs) => mixed;

type CacheConfig<KeyArgs, T> = {
  keyFactory?: KeyFactory<KeyArgs>,
  dispose?: DisposeCallback<T>,
};

export class SimpleCache<KeyArgs, T> {
  store: Map<mixed, T> = new Map();
  _dispose: ?DisposeCallback<T>;
  _keyFactory: KeyFactory<KeyArgs>;

  constructor(config: CacheConfig<KeyArgs, T> = {}) {
    if (config.dispose != null) {
      this._dispose = config.dispose;
    }
    this._keyFactory =
      config.keyFactory != null
        ? config.keyFactory
        : (keyArgs: KeyArgs) => keyArgs;
  }

  _getUnsafe(key: mixed): T {
    return ((this.store.get(key): any): T);
  }

  getOrCreate(keyArgs: KeyArgs, factory: (KeyArgs, mixed) => T): T {
    const key = this._keyFactory(keyArgs);
    if (this.store.has(key)) {
      return this._getUnsafe(key);
    }
    const value = factory(keyArgs, key);
    this.store.set(key, value);
    return value;
  }

  delete(keyArgs: KeyArgs): void {
    const key = this._keyFactory(keyArgs);
    if (this._dispose != null) {
      this._ifHas(key, this._dispose);
    }
    this.store.delete(key);
  }

  clear(): void {
    if (this._dispose != null) {
      this.store.forEach(this._dispose);
    }
    this.store.clear();
  }

  get(keyArgs: KeyArgs): ?T {
    return this.store.get(this._keyFactory(keyArgs));
  }

  set(keyArgs: KeyArgs, value: T): void {
    this.store.set(this._keyFactory(keyArgs), value);
  }

  ifHas(keyArgs: KeyArgs, callback: (value: T) => void) {
    this._ifHas(this._keyFactory(keyArgs), callback);
  }

  _ifHas(key: mixed, callback: (value: T) => void) {
    if (this.store.has(key)) {
      callback(this._getUnsafe(key));
    }
  }

  keyForArgs(keyArgs: KeyArgs): mixed {
    return this._keyFactory(keyArgs);
  }
}
