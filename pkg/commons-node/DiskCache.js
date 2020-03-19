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

import fsPromise from 'nuclide-commons/fsPromise';

/**
 * A simple cache that has the ability to persist itself from/to disk.
 * Values must be JSON-serializable.
 */
export default class DiskCache<K, V> {
  // Use a plain object for faster loading/saving.
  // We'll be careful to use an Object without a prototype below.
  _cache: {[key: string]: V};
  _cacheKeyFunc: K => string;
  _cachePath: string;
  _byteSize: number;

  constructor(cachePath: string, cacheKeyFunc: K => string) {
    // Flow (rightfully) does not consider Object.create(null) as a real Object.
    // Fortunately we don't need to make use of any Object.prototype methods here.
    // $FlowIgnore
    this._cache = Object.create(null);
    this._cacheKeyFunc = cacheKeyFunc;
    this._cachePath = cachePath;
    this._byteSize = 0;
  }

  getPath(): string {
    return this._cachePath;
  }

  /**
   * Returns the size, in bytes, of the most recently serialized value.
   */
  getByteSize(): number {
    return this._byteSize;
  }

  /**
   * Attempts to load the cache from disk.
   * Returns false if the cache no longer exists, or is corrupt.
   */
  async load(): Promise<boolean> {
    try {
      const data = await fsPromise.readFile(this._cachePath, 'utf8');
      this._byteSize = data.length;
      // Make sure we don't pick up any Object prototype methods.
      this._cache = Object.assign(Object.create(null), JSON.parse(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  async save(): Promise<boolean> {
    try {
      const data = JSON.stringify(this._cache);
      this._byteSize = data.length;
      await fsPromise.writeFileAtomic(this._cachePath, data);
      return true;
    } catch (err) {
      return false;
    }
  }

  get(key: K): ?V {
    return this._cache[this._cacheKeyFunc(key)];
  }

  set(key: K, value: V): void {
    this._cache[this._cacheKeyFunc(key)] = value;
  }
}
