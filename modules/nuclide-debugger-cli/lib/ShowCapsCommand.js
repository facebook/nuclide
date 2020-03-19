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

export default class ShowCapsCommand implements Command {
  name = 'adapter';
  helpText = 'Display inforrmation about the debug adapter.';

  _console: ConsoleIO;
  _debugger: DebuggerInterface;

  constructor(console: ConsoleIO, debug: DebuggerInterface) {
    this._console = console;
    this._debugger = debug;
  }

  async execute(): Promise<void> {
    const caps = this._debugger.adapterCaps();
    Object.keys(caps)
      .sort()
      .forEach(cap =>
        this._console.outputLine(`${cap} - ${JSON.stringify(caps[cap])}`),
      );
  }
}
