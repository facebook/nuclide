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

import type {
  AtomNotification,
  AtomNotificationType,
} from '../../nuclide-debugger-base/lib/types';
import {Observable, Subject} from 'rxjs';

export default class ClientCallback {
  _serverMessageObservable: Subject<string>; // For server messages.
  _userOutputObservable: Subject<string>; // For user visible output messages.
  _atomNotificationObservable: Subject<AtomNotification>;

  constructor() {
    this._serverMessageObservable = new Subject();
    this._userOutputObservable = new Subject();
    this._atomNotificationObservable = new Subject();
  }

  getServerMessageObservable(): Observable<string> {
    return this._serverMessageObservable.asObservable();
  }

  getOutputWindowObservable(): Observable<string> {
    return this._userOutputObservable.asObservable();
  }

  getAtomNotificationObservable(): Observable<AtomNotification> {
    return this._atomNotificationObservable.asObservable();
  }

  sendChromeMessage(message: string): void {
    this._serverMessageObservable.next(message);
  }

  sendUserOutputMessage(message: string): void {
    this._userOutputObservable.next(message);
  }

  sendAtomNotification(type: AtomNotificationType, message: string): void {
    this._atomNotificationObservable.next({type, message});
  }

  dispose(): void {
    this._serverMessageObservable.complete();
    this._userOutputObservable.complete();
    this._atomNotificationObservable.complete();
  }
}
