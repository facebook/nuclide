/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {Observable} from 'rxjs';
import {splitStream} from 'nuclide-commons/observable';
import {observeStream} from 'nuclide-commons/stream';
import invariant from 'assert';
import type {MessageLogger} from './index';

export class StreamTransport {
  _output: stream$Writable;
  _messages: Observable<string>;
  _messageLogger: MessageLogger;
  _isClosed: boolean;

  constructor(
    output: stream$Writable,
    input: stream$Readable,
    messageLogger: MessageLogger = (direction, message) => {
      return;
    },
  ) {
    this._isClosed = false;
    this._messageLogger = messageLogger;
    this._output = output;
    this._messages = splitStream(observeStream(input)).do(message => {
      this._messageLogger('receive', message);
    });
  }

  send(message: string): void {
    this._messageLogger('send', message);
    invariant(
      message.indexOf('\n') === -1,
      'StreamTransport.send - unexpected newline in JSON message',
    );
    this._output.write(message + '\n');
  }

  onMessage(): Observable<string> {
    return this._messages;
  }

  close(): void {
    this._isClosed = true;
  }

  isClosed(): boolean {
    return this._isClosed;
  }
}
