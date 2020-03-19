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

import idx from 'idx';
import TokenizedLine from './TokenizedLine';

export default class BackTraceCommand implements Command {
  name = 'where [num-frames]';
  helpText = 'Displays the call stack of the active thread.';
  detailedHelpText = `
where [num-frames]

Displays the call stack, showing the most recent stack frame first. For each
frame, the frame's index, the source code file (if available), and
line number are shown. An asterisk marks the currently selected frame.

If num-frames is specified, at most that many frames will be displayed. The
default number of frames to display is 100.
`;

  _console: ConsoleIO;
  _debugger: DebuggerInterface;

  static _defaultFrames: number = 100;

  constructor(con: ConsoleIO, debug: DebuggerInterface) {
    this._console = con;
    this._debugger = debug;
  }

  async execute(line: TokenizedLine): Promise<void> {
    const args = line.stringTokens().slice(1);
    const activeThread = this._debugger.getActiveThread();

    const frameCount =
      args.length < 1 ? BackTraceCommand._defaultFrames : parseInt(args[0], 10);
    if (isNaN(frameCount) || frameCount <= 0) {
      this._console.outputLine(
        'The number of frames must be a positive integer.',
      );
      return;
    }

    const frames = await this._debugger.getStackTrace(
      activeThread.id(),
      frameCount,
    );
    const selectedFrame = activeThread.selectedStackFrame();
    this._console.outputLine(
      frames
        .map((frame, index) => {
          const selectedMarker = index === selectedFrame ? '*' : ' ';
          const path = idx(frame, _ => _.source.path) || null;
          const location =
            path != null ? `${path}:${frame.line}` : '[no source]';
          return `${selectedMarker} #${index} ${frame.name} ${location}`;
        })
        .join('\n'),
    );
  }
}
