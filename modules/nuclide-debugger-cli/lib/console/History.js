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
import fs from 'fs';

export default class History {
  _maxItems: ?number;
  _removeDups: boolean;
  _items: string[];
  _nextItem: number;
  _saveFile: ?string;

  constructor(maxItems: ?number, removeDups: boolean, saveFile: ?string) {
    this._maxItems = maxItems;
    this._removeDups = removeDups;
    this._items = [];
    this._nextItem = 0;
    this._saveFile = saveFile;

    if (saveFile != null) {
      try {
        this._items = fs
          .readFileSync(saveFile, 'utf-8')
          .split('\n')
          .map(_ => _.trim())
          .filter(_ => _ !== '');
        if (maxItems != null && this._items.length > maxItems) {
          this._items = this._items.slice(-maxItems);
        }
        this._nextItem = this._items.length;
      } catch (_) {}
    }
  }

  save(): void {
    if (this._saveFile != null) {
      try {
        fs.writeFileSync(this._saveFile, this._items.join('\n'));
      } catch (_) {}
    }
  }

  addItem(s: string): void {
    if (this._removeDups) {
      const existing = this._items.indexOf(s);
      if (existing !== -1) {
        // reorder the history so the one copy of the current item is the most
        // recent
        this._items.push(this._items.splice(existing, 1)[0]);
        return;
      }
    }

    if (this._items.length === this._maxItems) {
      this._items.shift();
    }
    this._items.push(s);
  }

  resetSearch(): void {
    this._nextItem = this._items.length;
  }

  previousItem(): ?string {
    if (this._nextItem > 0) {
      --this._nextItem;
      return this._items[this._nextItem];
    }
    return null;
  }

  nextItem(): ?string {
    if (this._nextItem < this._items.length) {
      this._nextItem++;
      return this._items[this._nextItem];
    }
    return null;
  }
}
