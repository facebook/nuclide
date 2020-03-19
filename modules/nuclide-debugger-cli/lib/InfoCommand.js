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
import {DebuggerInterface} from './DebuggerInterface';
import TokenizedLine from './TokenizedLine';

export default class InfoCommand implements Command {
  name = 'info';
  helpText = '[object] Displays type information about an object';

  _console: ConsoleIO;
  _debugger: DebuggerInterface;

  constructor(con: ConsoleIO, debug: DebuggerInterface) {
    this._console = con;
    this._debugger = debug;
  }

  async execute(line: TokenizedLine): Promise<void> {
    const args = line.stringTokens().slice(1);
    if (args.length > 1) {
      throw new Error("'info' takes at most one object parameter");
    }

    const response = await this._debugger.info(args[0]);

    this._console.outputLine(response.body.info);
  }
}
