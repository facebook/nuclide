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

import os from 'os';
import {Observable} from 'rxjs';
import {trackImmediate} from 'nuclide-commons/analytics';

type InterruptEvent = {
  type: 'interrupt',
};

type LineEvent = {
  type: 'line',
  line: string,
};

type Event = InterruptEvent | LineEvent;

type PostObject = (
  path: string,
  // $FlowFixMe old declaration in fb-interngraph
  data: Object,
  customHeaders: {},
  // $FlowFixMe old declaration in fb-interngraph
) => Promise<Object>;

export default class OptoutCommand implements Command {
  name = 'zzz';
  helpText = 'Temporarily opt out of fbdbg.';

  _postObject: PostObject;
  _console: ConsoleIO;
  _pendingText: string = '';
  _subscription: ?rxjs$ISubscription = null;

  constructor(console: ConsoleIO, postObject: PostObject) {
    this._postObject = postObject;
    this._console = console;
  }

  async execute(): Promise<void> {
    this._console.output(
      '\n' +
        'You will be temporarily opted out of fbdbg. Fbdbg will eventually replace\n' +
        'hphpd, at which time the optout will expire. Please tell us why you would\n' +
        'like to opt out so we may improve the experience. Thanks!\n\n' +
        "Enter your reason; end with a single dot '.'. Use ctrl+c to abort.\n",
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
            this._console.outputLine(
              'Entry aborted; you will not be opted out.',
            );
            this._closeNestedInput();
            break;

          case 'line':
            if (event.line === '.') {
              this._console.setPrompt('');
              return Observable.fromPromise(this._eval());
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
    const reason = this._pendingText.trim();
    if (reason === '') {
      this._console.outputLine(
        'You did not give an opt-out reason and will not be opted out.\n',
      );
      return;
    }

    trackImmediate('fbdbg/optout', {
      reason,
    });

    try {
      const result = await this._postObject(
        'nuclide/fbdbg/optout',
        {userID: os.userInfo().username, action: 'optout'},
        {},
      );

      if (result.success !== true) {
        this._console.outputLine(
          `Opt-out call failed, please try again later. ${JSON.stringify(
            result,
          )}`,
        );
        return;
      }
    } catch (err) {
      this._console.outputLine(`Failed! ${err.message}`);
      return;
    }

    this._console.outputLine(
      'You have been successfully opted out (for now). If you quit and restart,\nyou will enter classic hphpd.',
    );
  }
}
