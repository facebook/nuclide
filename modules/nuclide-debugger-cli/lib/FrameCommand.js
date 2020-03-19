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

export default class BackTraceCommand implements Command {
  name = 'frame';
  helpText = 'Sets the current stack trace frame.';
  detailedHelpText = `
frame frame-index

The frame index must be the index of a frame in the range displayed by 'backtrace'.
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
    const args = line.stringTokens().slice(1);

    if (args.length !== 1) {
      throw new Error("'frame' takes the index of the frame to select");
    }

    const frameArg = args[0];

    if (frameArg.match(/^\d+$/) == null) {
      throw new Error('Argument must be a numeric frame index.');
    }

    const newSelectedFrame = parseInt(frameArg, 10);
    await this._debugger.setSelectedStackFrame(activeThread, newSelectedFrame);
  }
}
