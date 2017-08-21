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

import {Observable, Subject} from 'rxjs';

// A Cache mapping keys to values which creates entries as they are requested.
export class Cache<KeyType, ValueType> {
  _values: Map<KeyType, ValueType>;
  _factory: (key: KeyType) => ValueType;
  _disposeValue: (value: ValueType) => mixed;
  _entriesSubject: Subject<[KeyType, ValueType]>;

  constructor(
    factory: (key: KeyType) => ValueType,
    disposeValue: (value: ValueType) => mixed = value => {},
  ) {
    this._values = new Map();
    this._factory = factory;
    this._disposeValue = disposeValue;
    this._entriesSubject = new Subject();
  }

  has(key: KeyType): boolean {
    return this._values.has(key);
  }

  get(key: KeyType): ValueType {
    if (!this._values.has(key)) {
      const newValue = this._factory(key);
      this._values.set(key, newValue);
      this._entriesSubject.next([key, newValue]);
      return newValue;
    } else {
      // Cannot use invariant as ValueType may include null/undefined.
      return (this._values.get(key): any);
    }
  }

  // After this method this._values.keys() === newKeys.
  // deletes all keys not in newKeys
  // gets all keys in newKeys
  setKeys(newKeys: Set<KeyType>): void {
    for (const existingKey of this._values.keys()) {
      if (!newKeys.has(existingKey)) {
        this.delete(existingKey);
      }
    }

    for (const newKey of newKeys) {
      this.get(newKey);
    }
  }

  keys(): Iterator<KeyType> {
    return this._values.keys();
  }

  values(): Iterator<ValueType> {
    return this._values.values();
  }

  observeValues(): Observable<ValueType> {
    return this.observeEntries().map(entry => entry[1]);
  }

  observeEntries(): Observable<[KeyType, ValueType]> {
    return Observable.concat(
      Observable.from(this._values.entries()),
      this._entriesSubject,
    );
  }

  observeKeys(): Observable<KeyType> {
    return this.observeEntries().map(entry => entry[0]);
  }

  delete(key: KeyType): boolean {
    if (this.has(key)) {
      const value = this.get(key);
      this._values.delete(key);
      this._disposeValue(value);
      return true;
    } else {
      return false;
    }
  }

  clear(): void {
    // Defend against a dispose call removing elements from the Cache.
    const values = this._values;
    this._values = new Map();
    for (const value of values.values()) {
      this._disposeValue(value);
    }
  }

  dispose(): void {
    this.clear();
    this._entriesSubject.complete();
  }
}

// Useful for optional second parameter to Cache constructor.
export const DISPOSE_VALUE = (value: IDisposable) => {
  value.dispose();
};
