/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import TokenizedLine from './TokenizedLine';

export default class BreakpointCommandParser {
  _line: TokenizedLine;
  _args: Array<string>;
  _nextArg: number;
  _once: boolean;
  _sourceFile: ?string;
  _sourceLine: ?number;
  _functionName: ?string;
  _condition: ?string;
  _end: boolean;

  _linePattern: RegExp = /^(\d+)$/;
  _sourcePattern: RegExp = /^(.+):(\d+)$/;
  _functionPattern: RegExp = /^(.+)\(\)/;

  constructor(line: TokenizedLine) {
    this._line = line;
    this._args = line.stringTokens();
    this._nextArg = 1; // token 0 is the breakpoint command
    this._once = false;
    this._end = false;
  }

  sourceFile(): ?string {
    return this._sourceFile;
  }

  sourceLine(): ?number {
    return this._sourceLine;
  }

  functionName(): ?string {
    return this._functionName;
  }

  condition(): ?string {
    return this._condition;
  }

  once(): boolean {
    return this._once;
  }

  parse(): boolean {
    this._parseOnce();
    if (this._end) {
      return true;
    }

    this._parseConditional();
    if (this._end) {
      return true;
    }

    // at this point, having or not having a breakpoint spec determines
    // if this is a breakpoint set command or some other command
    if (!this._parseSpec()) {
      return false;
    }

    this._parseConditional();

    return true;
  }

  _parseOnce(): void {
    if ('once'.startsWith(this._currentArg())) {
      this._once = true;
      this._skipArg();
    }
  }

  _parseConditional(): void {
    if ('if'.startsWith(this._currentArg())) {
      this._skipArg();
      if (this._currentArg() == null) {
        throw new Error('Conditional breakpoint requires condition expression');
      }
      this._condition = this._line.rest(this._nextArg);
      this._end = true;
    }
  }

  _parseSpec(): boolean {
    const spec = this._currentArg();
    this._skipArg();

    if (spec == null) {
      // this means set a breakpoint at the current stack location
      return true;
    }

    const lineMatch = spec.match(this._linePattern);
    if (lineMatch != null) {
      this._sourceLine = parseInt(lineMatch[1], 10);
      return true;
    }

    const sourceMatch = spec.match(this._sourcePattern);
    if (sourceMatch != null) {
      const [, sourceFile, line] = sourceMatch;
      this._sourceFile = sourceFile;
      this._sourceLine = parseInt(line, 10);
      return true;
    }

    const funcMatch = spec.match(this._functionPattern);
    if (funcMatch != null) {
      this._functionName = funcMatch[1];
      return true;
    }

    return false;
  }

  _currentArg(): string {
    return this._args[this._nextArg];
  }

  _skipArg(): void {
    if (!this._end) {
      this._nextArg++;
      if (this._nextArg == null) {
        this._end = true;
      }
    }
  }
}
