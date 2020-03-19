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

import {arrayCompact} from 'nuclide-commons/collection';

import Breakpoint, {BreakpointState} from './Breakpoint';
import nullthrows from 'nullthrows';

export type SourceBreakpoint = {
  index: number,
  id: ?number,
  verified: boolean,
  enabled: boolean,
  path: string,
  line: number,
  condition: ?string,
};

export type FunctionBreakpoint = {
  index: number,
  id: ?number,
  verified: boolean,
  enabled: boolean,
  path: ?string,
  line: ?number,
  func: string,
  condition: ?string,
};

export default class BreakpointCollection {
  _breakpoints: Map<number, Breakpoint> = new Map();
  _nextIndex: number = 1;
  _allowOnceState: boolean = false;
  _allowConditional: boolean = false;

  enableOnceState(): void {
    this._allowOnceState = true;
    this._breakpoints.forEach(breakpoint => breakpoint.enableSupportsOnce());
  }

  enableConditional(): void {
    this._allowConditional = true;
  }

  supportsOnceState(): boolean {
    return this._allowOnceState;
  }

  supportsConditional(): boolean {
    return this._allowConditional;
  }

  addSourceBreakpoint(
    path: string,
    line: number,
    once: boolean,
    condition: ?string,
  ): number {
    this._breakpoints.forEach((breakpoint, index) => {
      if (breakpoint.path === path && breakpoint.line === line) {
        throw new Error(`There is already a breakpoint (#${index}) here.`);
      }
    });

    const index = this._allocateIndex();
    const breakpoint = new Breakpoint(index, this._allowOnceState);
    breakpoint.setPath(path);
    breakpoint.setLine(line);
    if (once) {
      breakpoint.setState(BreakpointState.ONCE);
    }
    breakpoint.setCondition(condition);

    this._breakpoints.set(index, breakpoint);
    return index;
  }

  addFunctionBreakpoint(
    func: string,
    once: boolean,
    condition: ?string,
  ): number {
    this._breakpoints.forEach((breakpoint, index) => {
      if (breakpoint.func === func) {
        throw new Error(`There is already a breakpoint (#${index}) here.`);
      }
    });

    const index = this._allocateIndex();
    const breakpoint = new Breakpoint(index, this._allowOnceState);
    breakpoint.setFunc(func);
    if (once) {
      breakpoint.setState(BreakpointState.ONCE);
    }
    breakpoint.setCondition(condition);
    this._breakpoints.set(index, breakpoint);
    return index;
  }

  getAllEnabledBreakpointsForSource(path: string): Array<SourceBreakpoint> {
    try {
      return Array.from(this._breakpoints.values())
        .filter(
          x =>
            x.path === path &&
            x.line != null &&
            x.func == null &&
            x.isEnabled(),
        )
        .map(_ => ({
          index: _.index,
          id: _.id,
          verified: _.verified,
          enabled: true,
          path: nullthrows(_.path),
          line: nullthrows(_.line),
          condition: _.condition(),
        }));
    } catch (_) {
      throw new Error(
        'Path or line missing in getAllEnabledBreakpointsForSource',
      );
    }
  }

  getAllEnabledBreakpointsByPath(): Map<string, Array<SourceBreakpoint>> {
    const sources = new Set(
      arrayCompact(Array.from(this._breakpoints.values()).map(_ => _.path)),
    );
    return new Map(
      Array.from(sources).map(src => [
        src,
        this.getAllEnabledBreakpointsForSource(src),
      ]),
    );
  }

  getAllEnabledFunctionBreakpoints(): Array<FunctionBreakpoint> {
    try {
      return Array.from(this._breakpoints.values())
        .filter(x => x.func != null && x.isEnabled())
        .map(x => ({
          index: x.index,
          id: x.id,
          verified: x.verified,
          enabled: true,
          path: x.path,
          line: x.line,
          func: nullthrows(x.func),
          condition: x.condition(),
        }));
    } catch (_) {
      throw new Error('Missing function in function breakpoint');
    }
  }

  getBreakpointByIndex(index: number): Breakpoint {
    const breakpoint = this._breakpoints.get(index);

    if (breakpoint == null) {
      throw new Error(`There is no breakpoint #${index}`);
    }

    return breakpoint;
  }

  getBreakpointById(id: number): Breakpoint {
    const breakpoint: ?Breakpoint = Array.from(this._breakpoints.values()).find(
      _ => _.id === id,
    );

    if (breakpoint == null) {
      throw new Error(`There is no breakpoint with id ${id}`);
    }

    return breakpoint;
  }

  getAllBreakpoints(): Breakpoint[] {
    return Array.from(this._breakpoints.values());
  }

  getAllBreakpointPaths(): string[] {
    try {
      return Array.from(
        new Set(
          Array.from(this._breakpoints.values())
            .filter(bp => bp.path != null)
            .map(bp => nullthrows(bp.path)),
        ),
      );
    } catch (_) {
      throw new Error('Missing breakpoint path in getAllBreakpointPaths');
    }
  }

  deleteBreakpoint(index: number): void {
    this._breakpoints.delete(index);
  }

  deleteAllBreakpoints(): void {
    this._breakpoints = new Map();
  }

  setBreakpointId(index: number, id: number): void {
    const bpt = this._breakpoints.get(index);
    if (bpt != null) {
      bpt.setId(id);
    }
  }

  setBreakpointVerified(index: number, verified: boolean): void {
    const bpt = this._breakpoints.get(index);
    if (bpt != null) {
      bpt.setVerified(verified);
    }
  }

  setPathAndFile(index: number, path: string, line: number): void {
    const bpt = this._breakpoints.get(index);
    if (bpt != null) {
      bpt.setPath(path);
      bpt.setLine(line);
    }
  }

  _allocateIndex(): number {
    return this._nextIndex++;
  }
}
