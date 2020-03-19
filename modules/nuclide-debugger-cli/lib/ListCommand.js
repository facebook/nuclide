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
import type {ConsoleIO} from './ConsoleIO';
import type {Command} from './Command';

import {
  STACK_FRAME_FOCUS_CHANGED,
  THREAD_FOCUS_CHANGED,
  DebuggerInterface,
} from './DebuggerInterface';
import leftPad from './Format';
import TokenizedLine from './TokenizedLine';

type SourceReference = {
  source: DebugProtocol.Source,
  line: number,
};

export default class ListCommand implements Command {
  name = 'list';
  helpText =
    "[line | source[:line] | @[:line]]: list source file contents. '@' may be used to refer to the source at the current stack frame.";

  detailedHelpText = `
list [line | source[:line] | @[:line]]

Lists source files.

With no arguments, list tries to continue displaying the current source file. If
a file has been previously listed, then that is the current source file; otherwise,
the current source file is the file containing the location of the selected stack
frame.

If just a line number is given, then the current source file will be listed starting
at that line.

If just a source file is given, then that file will be listed started at the beginning.
If a line number is also given, then the listing will start at that line.

'@' may be used as a shorthand for the source file of the current location in the
selected stack frame. With no line number, the listing will attempt to center the
current location in the ouput. Otherwise, listing will begin at the given line number.
  `;

  static _formatError = "Format is 'list [source[:line]]'.";
  static _linesToPrint = 25;

  _console: ConsoleIO;
  _debugger: DebuggerInterface;

  _source: DebugProtocol.Source = {};
  _nextLine: number = 1;
  _sourceIsStackFrame: boolean = false;
  _stackFrameLine: number = 0;

  constructor(con: ConsoleIO, debug: DebuggerInterface) {
    this._console = con;
    this._debugger = debug;

    // $FlowFixMe until I figure out how to represent that debugger is an EventEmitter
    this._debugger
      .on(THREAD_FOCUS_CHANGED, () => this._clearHistory())
      .on(STACK_FRAME_FOCUS_CHANGED, () => this._clearHistory());
  }

  async execute(line: TokenizedLine): Promise<void> {
    const args = line.stringTokens().slice(1);
    let ref: SourceReference;

    switch (args.length) {
      case 0:
        if (this._sourceIsEmpty()) {
          ref = await this._parseSourcePath('@');
        } else {
          ref = {
            source: this._previousSource(),
            line: this._nextLine,
          };
        }
        break;

      case 1:
        ref = await this._parseSourcePath(args[0]);
        break;

      default:
        throw new Error(ListCommand._formatError);
    }

    await this._printSourceLines(ref);
  }

  _clearHistory(): void {
    // Default behavior if list is re-run is to show more source.
    // When the current thread or stack frame changes, reset that
    // state so the first 'list' always shows source around the stop location
    this._source.path = '';
  }

  _previousSource(): DebugProtocol.Source {
    if (this._sourceIsEmpty()) {
      throw new Error('There is no current source file to list.');
    }

    return this._source;
  }

  async _parseSourcePath(sourceRef: string): Promise<SourceReference> {
    // just line on current source
    let match = sourceRef.match(/^(\d+)$/);
    if (match != null) {
      const [, line] = match;
      return {
        source: this._previousSource(),
        line: parseInt(line, 10),
      };
    }

    // source:line (where source may be '@' meaning current stack frame source)
    match = sourceRef.match(/^([^:]+)(:(\d+))?$/);
    if (match != null) {
      const [, sourcePath, , lineStr] = match;
      let line = lineStr != null ? parseInt(lineStr, 10) : 1;

      let source = {path: sourcePath};

      this._sourceIsStackFrame = sourcePath === '@';

      if (this._sourceIsStackFrame) {
        const stackFrame = await this._debugger.getCurrentStackFrame();
        if (stackFrame == null || stackFrame.source == null) {
          throw new Error(
            'Source is not available for the current stack frame.',
          );
        }

        source = stackFrame.source;
        this._stackFrameLine = stackFrame.line;

        if (lineStr == null) {
          // If no line was specified, center around current line in
          // stack frame
          line = Math.max(
            1,
            this._stackFrameLine - Math.floor(ListCommand._linesToPrint / 2),
          );
        }
      }

      return {
        source,
        line,
      };
    }

    throw new Error(ListCommand._formatError);
  }

  async _printSourceLines(ref: SourceReference): Promise<void> {
    let sourceLines: string[];

    try {
      sourceLines = await this._debugger.getSourceLines(
        ref.source,
        ref.line,
        ListCommand._linesToPrint,
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        this._console.outputLine('Source file does not exist.');
        return;
      }

      this._console.outputLine('Error reading source file.');
      return;
    }

    if (ref.source.path != null) {
      this._console.outputLine(`Listing ${ref.source.path}`);
    }

    if (sourceLines.length === 0) {
      throw new Error(`No source found at line ${ref.line}.`);
    }

    const maxLineNumber = ref.line + sourceLines.length - 1;
    const maxLength = String(maxLineNumber).length;

    let lineNumber = ref.line;
    for (const sourceLine of sourceLines) {
      let sep = ' |';
      if (this._sourceIsStackFrame && lineNumber === this._stackFrameLine) {
        sep = '=>';
      }
      this._console.outputLine(
        `${leftPad(String(lineNumber), maxLength)}${sep}   ${this._untabifyLine(
          sourceLine,
        )}`,
      );
      lineNumber++;
    }

    this._source = ref.source;
    this._nextLine = ref.line + sourceLines.length;
  }

  _sourceIsEmpty(): boolean {
    return (
      (this._source.path == null || this._source.path === '') &&
      (this._source.sourceReference == null ||
        this._source.sourceReference === 0)
    );
  }

  // the console itself does tab expansion, but it won't be right because
  // source code is formatted as if the lines start in column 1, which they
  // won't when we write them because of the line number prefix area.
  _untabifyLine(line: string): string {
    const pieces = line.split('\t');
    if (pieces.length === 0) {
      return '';
    }
    let lineOut = pieces[0];
    for (let i = 1; i < pieces.length; i++) {
      const piece = pieces[i];
      const spaces = 8 - (lineOut.length % 8);
      lineOut += ' '.repeat(spaces) + piece;
    }
    return lineOut;
  }
}
