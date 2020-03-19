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

import type Breakpoint from './Breakpoint';
import type {Command} from './Command';
import type {ConsoleIO} from './ConsoleIO';
import type {DebuggerInterface} from './DebuggerInterface';

import {breakpointFromArgList} from './BreakpointCommandUtils';
import TokenizedLine from './TokenizedLine';

export default class BreakpointClearCommand implements Command {
  name = 'clear';
  helpText =
    "[index | 'all']: permanently deletes a breakpoint, or all breakpoints. With no arguments, deletes the current breakpoint.";

  _console: ConsoleIO;
  _debugger: DebuggerInterface;

  constructor(con: ConsoleIO, debug: DebuggerInterface) {
    this._console = con;
    this._debugger = debug;
  }

  async execute(line: TokenizedLine): Promise<void> {
    const args = line.stringTokens().slice(1);
    const bpt: ?Breakpoint = breakpointFromArgList(
      this._debugger,
      args,
      this.name,
    );

    if (bpt == null) {
      await this._debugger.deleteAllBreakpoints();
      this._console.outputLine('All breakpoins cleared.');
      return;
    }

    await this._debugger.deleteBreakpoint(bpt);
    this._console.outputLine(`Breakpoint #${bpt.index} cleared.`);
  }
}
