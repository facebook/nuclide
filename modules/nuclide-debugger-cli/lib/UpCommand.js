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

import type {Command} from './Command';
import type {ConsoleIO} from './ConsoleIO';
import type {DebuggerInterface} from './DebuggerInterface';
import TokenizedLine from './TokenizedLine';

export default class UpCommand implements Command {
  name = 'up';
  helpText = 'Move to the next highest stack frame.';
  detailedHelpText = `
up

Moves to the next highest (away from the current break location) stack frame.
Selecting a stack frame tells the debugger to consider the state of the program
as if execution had stopped in that frame. Other commands which query program state
will use the selected frame for context; for example:

* The 'list' command, with no specified source file, will use the source file of
  the selected frame.
* The 'variables' command will display variables from the scope of the selected
  frame.
* The 'print' command will evaluate expression in terms of the variables that are
  in scope in the selected frame.
  `;

  _console: ConsoleIO;
  _debugger: DebuggerInterface;

  constructor(con: ConsoleIO, debug: DebuggerInterface) {
    this._console = con;
    this._debugger = debug;
  }

  async execute(line: TokenizedLine): Promise<void> {
    const activeThread = this._debugger.getActiveThread();
    await this._debugger.setSelectedStackFrame(
      activeThread,
      activeThread.selectedStackFrame() + 1,
    );
  }
}
