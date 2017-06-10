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

/* global localStorage */

import {nextAnimationFrame} from 'nuclide-commons/observable';

type Entry<T> = {key: string, value: T};

export class LocalStorageJsonTable<T> {
  _localStorageKey: string;
  _db: ?Array<Entry<T>>;
  _clearCacheSubscription: ?rxjs$Subscription;
  _cacheSize: number;

  constructor(localStorageKey: string, cacheSize: number = 100) {
    this._localStorageKey = localStorageKey;
    this._cacheSize = cacheSize;
  }

  _open(): Array<Entry<T>> {
    if (this._db == null) {
      const json = localStorage.getItem(this._localStorageKey);
      let db;
      if (json != null && json !== '') {
        try {
          db = JSON.parse(json);
        } catch (err) {}
      }
      this._db = Array.isArray(db) ? db : [];
      // Clear the cache after this frame. We have to do this because other windows might be
      // interacting with the database too.
      if (this._clearCacheSubscription == null) {
        this._clearCacheSubscription = nextAnimationFrame.subscribe(() => {
          this._db = null;
          this._clearCacheSubscription = null;
        });
      }
    }
    return this._db;
  }

  dispose(): void {
    if (this._clearCacheSubscription != null) {
      this._clearCacheSubscription.unsubscribe();
    }
  }

  setItem(key: string, value: T): void {
    let db = this._open();
    const matchIndex = db.findIndex(({key: k}) => k === key);
    if (matchIndex !== -1) {
      const previousValue = db[matchIndex].value;
      // No reason to drop and re-push the most recent value
      if (value === previousValue && matchIndex === db.length - 1) {
        return;
      }
      db.splice(matchIndex, 1);
    }
    db.push({key, value});
    db = db.slice(-this._cacheSize);
    localStorage.setItem(this._localStorageKey, JSON.stringify(db));
  }

  getItem(key: string): ?T {
    const db = this._open();
    const entry = db.find(({key: k}) => key === k);
    return entry == null ? null : entry.value;
  }

  getEntries(): Array<Entry<T>> {
    return this._open().slice();
  }
}
