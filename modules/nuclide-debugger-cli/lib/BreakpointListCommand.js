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
import type {DebuggerInterface} from './DebuggerInterface';
import type {ConsoleIO} from './ConsoleIO';

import leftPad from './Format';
import TokenizedLine from './TokenizedLine';

export default class BreakpointListCommand implements Command {
  name = 'list';
  helpText = 'Lists all breakpoints.';

  _console: ConsoleIO;
  _debugger: DebuggerInterface;

  constructor(con: ConsoleIO, debug: DebuggerInterface) {
    this._console = con;
    this._debugger = debug;
  }

  async execute(line: TokenizedLine): Promise<void> {
    const breakpoints = this._debugger
      .getAllBreakpoints()
      .sort((left, right) => left.index - right.index);

    if (breakpoints.length === 0) {
      return;
    }

    const lastBreakpoint = breakpoints[breakpoints.length - 1];
    const indexSize = String(lastBreakpoint.index).length;
    const stopped: ?Breakpoint = this._debugger.getStoppedAtBreakpoint();

    breakpoints.forEach(bpt => {
      const attributes = [bpt.state];
      if (!bpt.verified) {
        attributes.push('unverified');
      }

      const stoppedHere = bpt.id != null && stopped === bpt;

      const index = leftPad(
        `${stoppedHere ? '*' : ' '}#${bpt.index}`,
        indexSize + 1,
      );
      const attrs = attributes.length === 0 ? '' : `(${attributes.join(',')})`;
      const cond = bpt.condition();
      this._console.outputLine(
        `${index} ${bpt.toString()} ${attrs}${
          cond == null ? '' : ` if ${cond}`
        }`,
      );
    });
  }
}
