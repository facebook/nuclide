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

import nullthrows from 'nullthrows';

export const BreakpointState = Object.freeze({
  ENABLED: 'enabled',
  ONCE: 'once',
  DISABLED: 'disabled',
});

export type BreakpointStateValues = 'enabled' | 'once' | 'disabled';

export default class Breakpoint {
  // index is the name of the breakpoint we show externally in the UI
  _index: number;

  // id is the attached breakpoint in the adapter (if the adapter supports it)
  _id: ?number;

  // verified tracks if the breakpoint was successfully set by the adapter.
  // it may not be if the referenced code was not yet loaded
  _verified: boolean;

  // state: enabled, once, or disabled
  _state: BreakpointStateValues;

  // condition: if the breakpoint is conditional, the condition expression
  _condition: ?string;

  // The source file of the breakpoint (which may be undefined if we have an
  // unresolved function breakpoint.)
  _path: ?string;

  // The line number of the breakpoint (which may be undefined if we have an
  // unresolved function breakpoint.)
  _line: ?number;

  // The function name of the breakpoint (only defined if the breakpoint is
  // a function breakpoint.)
  _func: ?string;

  // If the breakpoint should support the 'once' state
  _allowOnceState: boolean;

  constructor(index: number, allowOnceState: boolean) {
    this._index = index;
    this._verified = false;
    this._state = BreakpointState.ENABLED;
    this._allowOnceState = allowOnceState;
  }

  enableSupportsOnce(): void {
    this._allowOnceState = true;
  }

  get index(): number {
    return this._index;
  }

  get id(): ?number {
    return this._id;
  }

  setId(id: number): void {
    this._id = id;
  }

  setVerified(verified: boolean): void {
    this._verified = verified;
  }

  get verified(): boolean {
    return this._verified;
  }

  setState(state: BreakpointStateValues): void {
    if (state === BreakpointState.ONCE && !this._allowOnceState) {
      throw new Error('One-shot breakpoints are not supported.');
    }
    this._state = state;
  }

  toggleState(): BreakpointStateValues {
    switch (this._state) {
      case BreakpointState.DISABLED:
        this._state = BreakpointState.ENABLED;
        break;

      case BreakpointState.ENABLED:
        this._state = this._allowOnceState
          ? BreakpointState.ONCE
          : BreakpointState.DISABLED;
        break;

      case BreakpointState.ONCE:
        this._state = BreakpointState.ENABLED;
        break;
    }

    return this._state;
  }

  get state(): BreakpointStateValues {
    return this._state;
  }

  condition(): ?string {
    return this._condition;
  }

  setCondition(cond: ?string) {
    this._condition = cond;
  }

  isEnabled(): boolean {
    return this._state !== BreakpointState.DISABLED;
  }

  setPath(path: string) {
    this._path = path;
  }

  get path(): ?string {
    return this._path;
  }

  setLine(line: number) {
    this._line = line;
  }

  get line(): ?number {
    return this._line;
  }

  setFunc(func: string) {
    this._func = func;
  }

  get func(): ?string {
    return this._func;
  }

  toString(): string {
    const func = this._func;

    if (func != null) {
      if (this._path == null || this._line == null) {
        return `${func}()`;
      }
      return `${func}() [${this._path}:${this._line}]`;
    }

    try {
      return `${nullthrows(this._path)}:${nullthrows(this._line)}`;
    } catch (_) {
      throw new Error('Missing path or line in breakpoint description');
    }
  }
}
