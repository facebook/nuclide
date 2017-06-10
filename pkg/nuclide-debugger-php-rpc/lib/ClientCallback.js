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

import logger from './utils';
import {Observable, Subject, ReplaySubject} from 'rxjs';

import type {NotificationMessage} from './PhpDebuggerService';

export type UserMessageType = 'notification' | 'console' | 'outputWindow';
export type NotificationType = 'info' | 'warning' | 'error' | 'fatalError';

function createMessage(method: string, params: ?Object): Object {
  const result: Object = {method};
  if (params) {
    result.params = params;
  }
  return result;
}

/**
 * This class provides a central callback channel to communicate with debugger client.
 * Currently it provides four callback channels:
 * 1. Chrome server messages.
 * 2. Atom UI notification.
 * 3. Chrome console user messages.
 * 4. Output window messages.
 */
export class ClientCallback {
  _serverMessages: Subject<string>; // For server messages.
  _notifications: ReplaySubject<NotificationMessage>; // For atom UI notifications.
  _outputWindowMessages: Subject<string>; // For output window messages.

  constructor() {
    this._serverMessages = new Subject();
    this._outputWindowMessages = new Subject();
    // We use a `ReplaySubject` here because we want to allow notifications to be emitted possibly
    // before the client subscribes.  This is justified because:
    // 1. we only ever expect one subscriber on the client, and
    // 2. we expect the number of notifications to be small, so storage in memory is not an issue.
    this._notifications = new ReplaySubject();
  }

  getNotificationObservable(): Observable<NotificationMessage> {
    return this._notifications.asObservable();
  }

  getServerMessageObservable(): Observable<string> {
    return this._serverMessages.asObservable();
  }

  getOutputWindowObservable(): Observable<string> {
    return this._outputWindowMessages.asObservable();
  }

  sendUserMessage(type: UserMessageType, message: Object): void {
    logger.debug(`sendUserMessage(${type}): ${JSON.stringify(message)}`);
    switch (type) {
      case 'notification':
        this._notifications.next({
          type: message.type,
          message: message.message,
        });
        break;
      case 'console':
        this.sendServerMethod('Console.messageAdded', {
          message,
        });
        break;
      case 'outputWindow':
        this.sendOutputWindowMethod('Console.messageAdded', {
          message,
        });
        break;
      default:
        logger.error(`Unknown UserMessageType: ${type}`);
    }
  }

  unknownMethod(
    id: number,
    domain: string,
    method: string,
    params: ?Object,
  ): void {
    const message = 'Unknown chrome dev tools method: ' + domain + '.' + method;
    logger.debug(message);
    this.replyWithError(id, message);
  }

  replyWithError(id: number, error: string): void {
    this.replyToCommand(id, {}, error);
  }

  replyToCommand(id: number, result: Object, error: ?string): void {
    const value: Object = {id, result};
    if (error != null) {
      value.error = error;
    } else if (result.error != null) {
      value.error = result.error;
    }
    sendJsonObject(this._serverMessages, value);
  }

  sendServerMethod(method: string, params: ?Object) {
    sendJsonObject(this._serverMessages, createMessage(method, params));
  }

  sendOutputWindowMethod(method: string, params: ?Object) {
    sendJsonObject(this._outputWindowMessages, createMessage(method, params));
  }

  dispose(): void {
    logger.debug('Called ClientCallback dispose method.');
    this._notifications.complete();
    this._serverMessages.complete();
    this._outputWindowMessages.complete();
  }
}

function sendJsonObject(subject: Subject<string>, value: Object): void {
  const message = JSON.stringify(value);
  logger.debug(`Sending JSON: ${message}`);
  subject.next(message);
}
