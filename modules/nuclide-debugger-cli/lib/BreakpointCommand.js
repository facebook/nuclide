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
import type {DebuggerInterface, BreakpointSetResult} from './DebuggerInterface';
import type {ConsoleIO} from './ConsoleIO';

import invariant from 'assert';
import nullthrows from 'nullthrows';
import BreakpointClearCommand from './BreakpointClearCommand';
import BreakpointCommandParser from './BreakpointCommandParser';
import BreakpointDisableCommand from './BreakpointDisableCommand';
import BreakpointEnableCommand from './BreakpointEnableCommand';
import BreakpointListCommand from './BreakpointListCommand';
import BreakpointToggleCommand from './BreakpointToggleCommand';
import CommandDispatcher from './CommandDispatcher';
import HelpCommand from './HelpCommand';
import TokenizedLine from './TokenizedLine';

export default class BreakpointCommand implements Command {
  name = 'breakpoint';

  // $TODO this will need more thorough help which will require extending the
  // help system to support subcommands
  helpText = 'Sets a breakpoint on the target.';

  detailedHelpText = `
breakpoint [subcommand | [[o]nce] [source-file:]line] | [[o]nce] function-name()

Sets a breakpoint, or operates on existing breakpoints.

With no arguments, attempts to set a breakpoint at the current location as determined
by the selected stack frame. With no source file, attempts to set a breakpoint at
the given line number in the source file at the current location.

Upon setting a breakpoint, the debugger may respond that the breakpoint was set
but not bound. There are several reasons this can happen:

* The line number specified has no executable code associated with it.
* The source file specified does not exist.
* The breakpoint is in a proper location in a good source file, but information
  about the source file has not yet been loaded. Not all languages know what source
  files will be loaded in the course of execution; for example, in node a source
  file will not be become available until some other module has called 'require'
  on it.

If the breakpoint is incorrectly specified, it will never be hit. However, in the
latter case, the breakpoint will become active when the runtime loads the specified
file.

The breakpoint command has several subcommands:

* 'clear' will delete an existing breakpoint
* 'disable' will temporarily disable an existing breakpoint
* 'enable' will re-enable an existing breakpoint
* 'help' will give detailed information about the subcommands
* 'list' will list all existing breakpoints
* 'toggle' will toggle the enabled state of an existing breakpoint
  `;

  _debugger: DebuggerInterface;
  _console: ConsoleIO;
  _dispatcher: CommandDispatcher;

  constructor(con: ConsoleIO, debug: DebuggerInterface) {
    this._console = con;
    this._debugger = debug;
    this._dispatcher = new CommandDispatcher(new Map());

    this._dispatcher.registerCommand(new BreakpointClearCommand(con, debug));
    this._dispatcher.registerCommand(new BreakpointDisableCommand(con, debug));
    this._dispatcher.registerCommand(new BreakpointEnableCommand(con, debug));
    this._dispatcher.registerCommand(new BreakpointListCommand(con, debug));
    this._dispatcher.registerCommand(new BreakpointToggleCommand(con, debug));
    this._dispatcher.registerCommand(new HelpCommand(con, this._dispatcher));
  }

  async execute(line: TokenizedLine): Promise<void> {
    const result = await this._trySettingBreakpoint(line);
    if (result != null) {
      this._displayBreakpointResult(result);
      return;
    }

    const subcommand = new TokenizedLine(line.rest(1));

    const error = await this._dispatcher.executeTokenizedLine(subcommand);
    if (error != null) {
      throw error;
    }
  }

  async _trySettingBreakpoint(
    line: TokenizedLine,
  ): Promise<?BreakpointSetResult> {
    const parser = new BreakpointCommandParser(line);
    if (!parser.parse()) {
      return null;
    }

    if (parser.sourceFile() == null && parser.functionName() == null) {
      return this._setBreakpointHere(
        parser.sourceLine(),
        parser.once(),
        parser.condition(),
      );
    }

    if (parser.sourceFile() != null) {
      return this._debugger.setSourceBreakpoint(
        nullthrows(parser.sourceFile()),
        nullthrows(parser.sourceLine()),
        parser.once(),
        parser.condition(),
      );
    }

    const functionName = parser.functionName();
    invariant(functionName != null);
    return this._debugger.setFunctionBreakpoint(
      functionName,
      parser.once(),
      parser.condition(),
    );
  }

  _displayBreakpointResult(result: BreakpointSetResult): void {
    this._console.outputLine(`Breakpoint ${result.index} set.`);
    if (result.message != null) {
      this._console.outputLine(result.message);
    }
  }

  async _setBreakpointHere(
    line: ?number,
    once: boolean,
    condition: ?string,
  ): Promise<BreakpointSetResult> {
    const frame = await this._debugger.getCurrentStackFrame();
    if (frame == null) {
      throw new Error('Cannot set breakpoint here, no current stack frame.');
    }

    if (frame.source == null || frame.source.path == null) {
      throw new Error(
        'Cannot set breakpoint here, current stack frame has no source.',
      );
    }

    const result = await this._debugger.setSourceBreakpoint(
      frame.source.path,
      line == null ? frame.line : line,
      once,
      condition,
    );
    return result;
  }
}
