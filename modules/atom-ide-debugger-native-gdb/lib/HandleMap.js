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

export default class HandleMap<T> {
  DEFAULT_STARTING_HANDLE = 1000;

  _startingHandle: number;
  _objectsByHandle: Map<number, T>;
  _handlesByObject: Map<T, number>;
  _nextHandle: number;

  constructor(nextHandle: ?number) {
    this._startingHandle = nextHandle == null ? 1000 : nextHandle;
    this.clear();
  }

  clear() {
    this._nextHandle = this._startingHandle;
    this._objectsByHandle = new Map();
    this._handlesByObject = new Map();
  }

  get allObjects(): Array<T> {
    return Array.from(this._objectsByHandle.values());
  }

  put(obj: T): number {
    // maintain 1:1 mapping
    let handle = this._handlesByObject.get(obj);
    if (handle == null) {
      handle = this._nextHandle++;
      this._objectsByHandle.set(handle, obj);
      this._handlesByObject.set(obj, handle);
    }

    return handle;
  }

  getObjectByHandle(handle: number): ?T {
    return this._objectsByHandle.get(handle);
  }

  getHandleByObject(obj: T): ?number {
    return this._handlesByObject.get(obj);
  }

  removeHandle(handle: number): void {
    const obj = this._objectsByHandle.get(handle);
    if (obj != null) {
      this._handlesByObject.delete(obj);
      this._objectsByHandle.delete(handle);
    }
  }

  removeObject(obj: T): void {
    const handle = this._handlesByObject.get(obj);
    if (handle != null) {
      this._handlesByObject.delete(obj);
      this._objectsByHandle.delete(handle);
    }
  }

  toString(): string {
    return JSON.stringify([...this._objectsByHandle]);
  }
}
