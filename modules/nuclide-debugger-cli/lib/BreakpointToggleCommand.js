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

export default class BreakpointToggleCommand implements Command {
  name = 'toggle';
  helpText =
    "[index | 'all']: toggles a breakpoint, or all breakpoints. With no arguments, toggles the current breakpoint.";
  detailedHelpText = `
    [index | 'all']: toggles a breakpoint, or all breakpoints. With no arguments,
    toggles the current breakpoint.

    The effect of this command depends on the debug adapter in use. If the adapter
    does not support one-shot breakpoints, then toggle will toggle the breakpoint
    state between disabled and enabled.

    If the adapter DOES support one-shot breakpoints, then there is a third
    state called 'once' which means the breakpoint will fire exactly once and
    then be automatically disabled. toggle will move breakpoints through the
    cycle

      enabled => once => disabled

    You can also set a one-shot breakpoint by specifying the keyword 'once'
    before the breakpoint specification in the breakpoint command; i.e.

    breakpoint once main()
  `;

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
      await this._debugger.toggleAllBreakpoints();
      this._console.outputLine('All breakpoins toggled.');
      return;
    }

    await this._debugger.toggleBreakpoint(bpt);
    this._console.outputLine(`Breakpoint #${bpt.index} toggled.`);
  }
}
