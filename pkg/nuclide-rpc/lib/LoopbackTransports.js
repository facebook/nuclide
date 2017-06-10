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

import type {Transport} from '../lib/index';
import type {Observable} from 'rxjs';
import {Subject} from 'rxjs';

export class LoopbackTransports {
  serverTransport: Transport;
  clientTransport: Transport;

  constructor() {
    const serverMessages: Subject<string> = new Subject();
    const clientMessages: Subject<string> = new Subject();

    this.serverTransport = {
      _isClosed: false,
      send(message: string): void {
        clientMessages.next(message);
      },
      onMessage(): Observable<string> {
        return serverMessages;
      },
      close() {
        this._isClosed = true;
      },
      isClosed(): boolean {
        return this._isClosed;
      },
    };

    this.clientTransport = {
      _isClosed: false,
      send(message: string): void {
        serverMessages.next(message);
      },
      onMessage(): Observable<string> {
        return clientMessages;
      },
      close() {
        this._isClosed = true;
      },
      isClosed(): boolean {
        return this._isClosed;
      },
    };
  }
}
