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

import HandleMap from './HandleMap';

export class Breakpoint {
  _id: ?number;
  _source: ?string;
  _line: ?number;
  _condition: ?string;
  _verified: boolean;

  constructor(
    id: ?number,
    source: ?string,
    line: ?number,
    condition: ?string,
    verified: boolean,
  ) {
    this._id = id;
    this._source = source;
    this._line = line;
    this._condition = condition;
    this._verified = verified;
  }

  get id(): ?number {
    return this._id;
  }

  setId(n: number): void {
    this._id = n;
  }

  get source(): ?string {
    return this._source;
  }

  get line(): ?number {
    return this._line;
  }

  get condition(): ?string {
    return this._condition;
  }

  get verified(): boolean {
    return this._verified;
  }

  setVerified(): void {
    this._verified = true;
  }
}

export default class Breakpoints {
  _breakpoints: HandleMap<Breakpoint>;

  constructor() {
    this._breakpoints = new HandleMap();
  }

  addBreakpoint(bkpt: Breakpoint): number {
    return this._breakpoints.put(bkpt);
  }

  removeBreakpoint(bkpt: Breakpoint): void {
    this._breakpoints.removeObject(bkpt);
  }

  handleForBreakpoint(bkpt: Breakpoint): ?number {
    return this._breakpoints.getHandleByObject(bkpt);
  }

  breakpointByHandle(handle: number): ?Breakpoint {
    return this._breakpoints.getObjectByHandle(handle);
  }

  breakpointByDebuggerId(id: number): ?Breakpoint {
    return this._breakpoints.allObjects.find(_ => id === _.id);
  }

  breakpointsWithNoDebuggerId(): Array<Breakpoint> {
    return this._breakpoints.allObjects.filter(_ => _.id == null);
  }
}
