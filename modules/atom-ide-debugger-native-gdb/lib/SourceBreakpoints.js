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

import * as DebugProtocol from 'vscode-debugprotocol';
import invariant from 'assert';
import {Breakpoint} from './Breakpoints';
import Breakpoints from './Breakpoints';
import MIProxy from './MIProxy';
import {MIResultRecord} from './MIRecord';
import {breakInsertResult, toCommandError} from './MITypes';

type AddRemoveSets = {
  addBreakpoints: Array<DebugProtocol.SourceBreakpoint>,
  removeBreakpoints: Array<Breakpoint>,
};

export default class SourceBreakpoints {
  _client: MIProxy;
  _breakpoints: Breakpoints;

  // by source and line
  _reverseMap: Map<string, Map<number, Breakpoint>>;

  constructor(client: MIProxy, breakpoints: Breakpoints) {
    this._client = client;
    this._breakpoints = breakpoints;
    this._reverseMap = new Map();
  }

  // Returns a map from the requested lines to the breakpoint handles
  async setSourceBreakpoints(
    path: string,
    breakpoints: Array<DebugProtocol.SourceBreakpoint>,
  ): Promise<Array<DebugProtocol.Breakpoint>> {
    const addRemove = this._computeAddRemoveSets(path, breakpoints);

    if (!this._client.isConnected()) {
      this._cacheBreakpointsInConfiguration(path, addRemove);
    } else {
      await this._addRemoveBreakpointsViaProxy(path, addRemove);
    }

    return this._allBreakpointsForPath(path).map(bkpt =>
      this._breakpointToProtocolBreakpoint(bkpt),
    );
  }

  // Set pre-configuration breakpoints
  async setCachedBreakpoints(): Promise<Array<DebugProtocol.Breakpoint>> {
    const cachedBreakpoints = this._breakpoints.breakpointsWithNoDebuggerId();

    const results = await Promise.all(
      cachedBreakpoints.map(_ => {
        const source = _.source;
        const line = _.line;
        invariant(source != null);
        invariant(line != null);

        return this._setBreakpoint(source, line, _.condition);
      }),
    );

    results.forEach((response, index) => {
      if (response.done) {
        const result = breakInsertResult(response);
        const bkpt = result.bkpt[0];
        cachedBreakpoints[index].setId(parseInt(bkpt.number, 10));
        if (bkpt.pending == null) {
          cachedBreakpoints[index].setVerified();
        }
      }
    });

    return cachedBreakpoints
      .filter(_ => _.verified)
      .map(_ => this._breakpointToProtocolBreakpoint(_));
  }

  // We are given the set of lines which should be set for a file, not
  // a delta from the current set. We must compute the delta manually
  // to update the MI debugger.
  //
  _computeAddRemoveSets(
    path: string,
    breakpoints: Array<DebugProtocol.SourceBreakpoint>,
  ): AddRemoveSets {
    const existingBreakpoints = this._allBreakpointsForPath(path);
    const existingLines: Array<number> = existingBreakpoints.map(_ => {
      const line = _.line;
      invariant(line != null);
      return line;
    });

    const lines = breakpoints.map(_ => _.line);

    const removeBreakpoints = existingBreakpoints.filter(
      _ => !lines.includes(_.line),
    );

    const addBreakpoints: Array<
      DebugProtocol.SourceBreakpoint,
    > = breakpoints.filter(_ => !existingLines.includes(_.line));

    return {addBreakpoints, removeBreakpoints};
  }

  // If we're called before the proxy is set up, we need to cache the breakpoints
  // until gdb is launched
  _cacheBreakpointsInConfiguration(
    path: string,
    addRemove: AddRemoveSets,
  ): void {
    let forSource = this._reverseMap.get(path);
    if (forSource == null) {
      forSource = new Map();
      this._reverseMap.set(path, forSource);
    }

    for (const bpt of addRemove.removeBreakpoints) {
      if (bpt.line != null) {
        forSource.delete(bpt.line);
        this._breakpoints.removeBreakpoint(bpt);
      }
    }

    addRemove.addBreakpoints.forEach((breakpoint, index) => {
      const line = breakpoint.line;

      const newBreakpoint = new Breakpoint(
        null,
        path,
        line,
        breakpoint.condition,
        false,
      );

      invariant(forSource != null);
      forSource.set(line, newBreakpoint);
      this._breakpoints.addBreakpoint(newBreakpoint);
    });
  }

  async _addRemoveBreakpointsViaProxy(
    path: string,
    addRemove: AddRemoveSets,
  ): Promise<void> {
    const promises: Array<Promise<MIResultRecord>> = [];

    if (addRemove.removeBreakpoints.length !== 0) {
      const removeCommand = `break-delete ${addRemove.removeBreakpoints
        .map(_ => _.id)
        .join(' ')}`;
      promises.push(this._client.sendCommand(removeCommand));
    }

    for (const bkpt of addRemove.addBreakpoints) {
      promises.push(this._setBreakpoint(path, bkpt.line, bkpt.condition));
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

    let forSource = this._reverseMap.get(path);
    if (forSource == null) {
      forSource = new Map();
      this._reverseMap.set(path, forSource);
    }

    for (const bpt of addRemove.removeBreakpoints) {
      if (bpt.line != null) {
        forSource.delete(bpt.line);
        this._breakpoints.removeBreakpoint(bpt);
      }
    }

    const failure = results.find(_ => !_.done);
    if (failure != null) {
      throw new Error(
        `Failed adding new source breakpoints ${toCommandError(failure).msg}`,
      );
    }

    results.forEach((response, index) => {
      const result = breakInsertResult(response);
      const bkpt = result.bkpt[0];
      invariant(bkpt != null);

      // NB gdb will not return the line number of a pending breakpoint, so
      // use the one we were given
      const line = addRemove.addBreakpoints[index].line;

      const breakpoint = new Breakpoint(
        parseInt(bkpt.number, 10),
        path,
        line,
        addRemove.addBreakpoints[index].condition,
        bkpt.pending == null,
      );

      invariant(forSource != null);
      forSource.set(line, breakpoint);
      this._breakpoints.addBreakpoint(breakpoint);
    });
  }

  async _setBreakpoint(
    source: string,
    line: number,
    condition: ?string,
  ): Promise<MIResultRecord> {
    const conditionFlag =
      condition == null || condition.trim() === ''
        ? ''
        : `-c "${condition.replace('"', '\\"')}"`;

    const cmd = `break-insert -f --source ${source} --line ${line} ${conditionFlag}`;
    return this._client.sendCommand(cmd);
  }

  _allBreakpointsForPath(path: string): Array<Breakpoint> {
    let forSource = this._reverseMap.get(path);
    forSource = forSource != null ? [...forSource] : [];
    return forSource.map(_ => _[1]);
  }

  _breakpointToProtocolBreakpoint(bkpt: Breakpoint): DebugProtocol.Breakpoint {
    const handle = this._breakpoints.handleForBreakpoint(bkpt);
    invariant(handle != null, 'Could not find source breakpoint handle');
    invariant(bkpt.line != null);

    const bptRet = {
      id: handle,
      verified: bkpt.verified,
      source: {
        sourceReference: 0,
      },
      line: bkpt.line,
    };
    if (bkpt.source != null) {
      bptRet.source = {...bptRet.source, path: bkpt.source};
    }
    return bptRet;
  }
}
