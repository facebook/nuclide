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

import * as DebugProtocol from 'vscode-debugprotocol';
import invariant from 'assert';
import Breakpoints from './Breakpoints';
import {Breakpoint} from './Breakpoints';
import {logVerbose} from './Logger';
import MIProxy from './MIProxy';
import {MIResultRecord} from './MIRecord';
import {breakInsertResult, toCommandError} from './MITypes';

class FunctionBreakpoint extends Breakpoint {
  _functionName: string;

  constructor(
    id: ?number,
    source: ?string,
    line: ?number,
    functionName: string,
    verified: boolean,
  ) {
    super(id, source, line, null, verified);
    this._functionName = functionName;
  }

  get functionName(): string {
    return this._functionName;
  }
}

type AddRemoveSets = {
  addFunctions: Array<string>,
  removeBreakpoints: Array<FunctionBreakpoint>,
};

export default class FunctionBreakpoints {
  _client: MIProxy;
  _breakpoints: Breakpoints;
  _breakpointsByFunction: Map<string, FunctionBreakpoint>;

  constructor(client: MIProxy, breakpoints: Breakpoints) {
    this._client = client;
    this._breakpoints = breakpoints;
    this._breakpointsByFunction = new Map();
  }

  // Returns a an array of breakpoints in the same order as the source
  async setFunctionBreakpoints(
    functions: Array<string>,
  ): Promise<Array<DebugProtocol.Breakpoint>> {
    const addRemove = this._computeAddRemoveSets(functions);

    if (!this._client.isConnected()) {
      this._cacheBreakpointsInConfiguration(addRemove);
    } else {
      await this._addRemoveBreakpointsViaProxy(addRemove);
    }

    return [...this._breakpointsByFunction.values()].map(_ =>
      this._breakpointToProtocolBreakpoint(_),
    );
  }

  async setCachedBreakpoints(): Promise<Array<DebugProtocol.Breakpoint>> {
    const cachedBreakpoints = ((this._breakpoints.breakpointsWithNoDebuggerId(): any): Array<
      FunctionBreakpoint,
    >);

    const results = await Promise.all(
      cachedBreakpoints.map(_ => {
        return this._setBreakpoint(_.functionName);
      }),
    );

    results.forEach((response, index) => {
      if (response.done) {
        const result = breakInsertResult(response);
        const bkpt = result.bkpt[0];
        logVerbose(`breakpoint ${JSON.stringify(bkpt)}`);
        cachedBreakpoints[index].setId(parseInt(bkpt.number, 10));
        if (bkpt.pending == null) {
          logVerbose(`breakpoint ${index} is now verified`);
          cachedBreakpoints[index].setVerified();
        }
      }
    });

    return cachedBreakpoints
      .filter(_ => _.verified)
      .map(_ => this._breakpointToProtocolBreakpoint(_));
  }

  getBreakpointByHandle(handle: number): ?Breakpoint {
    return this._breakpoints.breakpointByHandle(handle);
  }

  // We are given the set of functions which should be set, not
  // a delta from the current set. We must compute the delta manually
  // to update the MI debugger.
  //
  _computeAddRemoveSets(functions: Array<string>): AddRemoveSets {
    const existingBreakpoints: Array<FunctionBreakpoint> = [
      ...this._breakpointsByFunction.values(),
    ];
    const existingFunctions = existingBreakpoints.map(_ => _.functionName);

    const removeBreakpoints = existingBreakpoints.filter(
      _ => !functions.includes(_.functionName),
    );

    const addFunctions: Array<string> = functions.filter(
      _ => !existingFunctions.includes(_),
    );

    return {addFunctions, removeBreakpoints};
  }

  // If we're called before the proxy is set up, we need to cache the breakpoints
  // until gdb is launched
  _cacheBreakpointsInConfiguration(addRemove: AddRemoveSets): void {
    for (const bpt of addRemove.removeBreakpoints) {
      this._breakpoints.removeBreakpoint(bpt);
      this._breakpointsByFunction.delete(bpt.functionName);
    }

    addRemove.addFunctions.forEach(_ => {
      const breakpoint = new FunctionBreakpoint(null, null, null, _, false);

      this._breakpoints.addBreakpoint(breakpoint);
      this._breakpointsByFunction.set(breakpoint.functionName, breakpoint);
    });
  }

  async _addRemoveBreakpointsViaProxy(addRemove: AddRemoveSets): Promise<void> {
    const promises: Array<Promise<MIResultRecord>> = [];

    if (addRemove.removeBreakpoints.length !== 0) {
      const removeCommand = `break-delete ${addRemove.removeBreakpoints
        .map(_ => _.id)
        .join(' ')}`;
      promises.push(this._client.sendCommand(removeCommand));
    }

    for (const name of addRemove.addFunctions) {
      promises.push(this._setBreakpoint(name));
    }

    const results = await Promise.all(promises);

    if (addRemove.removeBreakpoints.length !== 0) {
      const removeResult = results.shift();
      invariant(removeResult != null);
      if (removeResult.result.error) {
        // this means our internal state is out of sync with the debugger
        throw new Error(
          `Failed to remove breakpoints which should have existed (${
            toCommandError(removeResult).msg
          })`,
        );
      }
    }

    for (const bpt of addRemove.removeBreakpoints) {
      this._breakpoints.removeBreakpoint(bpt);
      this._breakpointsByFunction.delete(bpt.functionName);
    }

    const failure = results.find(_ => !_.done);
    if (failure != null) {
      throw new Error(
        `Failed to add function breakpokints (${toCommandError(failure).msg})`,
      );
    }

    results.forEach(_ => {
      logVerbose(JSON.stringify(_));
      const result = breakInsertResult(_);

      // We may get back a list of multiple sub breakpoints, each with a source/line,
      // but the protocol only supports one location right now.
      const bkpt = result.bkpt[0];
      invariant(bkpt != null);
      const location = bkpt['original-location'];
      invariant(location != null);

      // MI returns the location back as '-function functioname'
      const funcMatch = location.match(/^-function (.*)$/);
      invariant(funcMatch != null);
      const functionName = funcMatch[1];
      invariant(functionName != null);

      const verified = bkpt.pending == null;

      const breakpoint = new FunctionBreakpoint(
        parseInt(bkpt.number, 10),
        bkpt.file,
        parseInt(bkpt.line, 10),
        functionName,
        verified,
      );

      this._breakpoints.addBreakpoint(breakpoint);
      this._breakpointsByFunction.set(breakpoint.functionName, breakpoint);
    });
  }

  async _setBreakpoint(functionName: string): Promise<MIResultRecord> {
    // -f means insert unverified breakpoint rather than error if fn not found
    const cmd = `break-insert -f --function ${functionName}`;
    return this._client.sendCommand(cmd);
  }

  _breakpointToProtocolBreakpoint(
    breakpoint: FunctionBreakpoint,
  ): DebugProtocol.Breakpoint {
    const handle = this._breakpoints.handleForBreakpoint(breakpoint);
    invariant(handle != null);
    let bkpt = {
      id: handle,
      verified: breakpoint.verified,
      source: {sourceReference: 0},
    };
    if (breakpoint.source != null) {
      bkpt.source = {...bkpt.source, path: breakpoint.source};
    }
    if (breakpoint.line != null) {
      bkpt = {...bkpt, line: breakpoint.line};
    }
    return bkpt;
  }
}
