/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {Command} from './Command';
import type {ConsoleIO} from './ConsoleIO';

import {DebuggerInterface} from './DebuggerInterface';
import {Observable} from 'rxjs';

type InterruptEvent = {
  type: 'interrupt',
};

type LineEvent = {
  type: 'line',
  line: string,
};

type Event = InterruptEvent | LineEvent;

export default class EnterCode implements Command {
  name = 'kode';
  helpText = 'Enter a multi-line code fragment for evaluation.';

  _debugger: DebuggerInterface;
  _console: ConsoleIO;
  _pendingText: string = '';
  _subscription: ?rxjs$ISubscription = null;

  constructor(console: ConsoleIO, debug: DebuggerInterface) {
    this._debugger = debug;
    this._console = console;
  }

  async execute(): Promise<void> {
    if (!this._debugger.supportsCodeBlocks()) {
      this._console.outputLine(
        'This debug adapter does not support interpreted code.',
      );
      return;
    }
    this._console.output(
      "Enter code, end with a single dot '.'. Use ctrl+c to abort.\n",
    );
    this._pendingText = '';
    this._console.stopInput(true);
    this._console.setPrompt('... ');

    this._console.prompt();
    this._subscription = Observable.merge(
      this._console
        .observeInterrupts()
        .switchMap(_ => Observable.from([{type: 'interrupt'}])),
      this._console
        .observeLines()
        .switchMap(line => Observable.from([{type: 'line', line}])),
    )
      .switchMap((event: Event) => {
        switch (event.type) {
          case 'interrupt':
            this._console.outputLine('Code entry aborted.');
            this._closeNestedInput();
            break;

          case 'line':
            if (event.line === '.') {
              return this._eval();
            }
            this._pendingText = `${this._pendingText}\n${event.line}`;
            this._console.prompt();
        }
        return Observable.empty();
      })
      .subscribe(_ => this._closeNestedInput(), _ => this._closeNestedInput());
  }

  _closeNestedInput() {
    if (this._subscription != null) {
      this._subscription.unsubscribe();
    }
    this._subscription = null;
    this._console.setPrompt();
    this._console.startInput();
  }

  async _eval(): Promise<void> {
    try {
      const {
        body: {result},
      } = await this._debugger.evaluateExpression(this._pendingText, true);
      this._console.outputLine(result);
    } catch (err) {
      this._console.outputLine(err.message);
    }
  }
}
