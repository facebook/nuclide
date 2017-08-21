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

/**
 * Get a hash for the provider object. Hashes are unique per-hasher, so if you have two different
 * hashers, there is no guarantee that they will give the same hash for the same object.
 *
 * One use case for this is with lists of React elements. Just create a hasher and use the hash as
 * a key:
 *
 *    class MyComponent extends React.Component {
 *      constructor(props) {
 *        super(props);
 *        this._hasher = new Hasher();
 *      }
 *      render() {
 *        return this.props.items.map(item => (
 *          <ItemView key={this._hasher.getHash(item)} model={item} />
 *        ));
 *      }
 *    }
 */
export default class Hasher<K> {
  _hashes: WeakMap<K, string>;
  _objectCount: number;

  constructor() {
    this._hashes = new WeakMap();
    this._objectCount = 0;
  }

  getHash(item: K): string | number {
    if (item === null) {
      return 'null';
    }
    const type = typeof item;
    switch (typeof item) {
      case 'object': {
        let hash = this._hashes.get(item);
        if (hash == null) {
          hash = `${type}:${this._objectCount}`;
          this._hashes.set(item, hash);
          this._objectCount =
            this._objectCount + 1 === Number.MAX_SAFE_INTEGER
              ? Number.MIN_SAFE_INTEGER
              : this._objectCount + 1;
        }
        return hash;
      }
      case 'undefined':
        return 'undefined';
      case 'string':
      case 'boolean':
        return `${type}:${item.toString()}`;
      case 'number':
        return item;
      default:
        throw new Error('Unhashable object');
    }
  }
}
