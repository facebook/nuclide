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
import BaseClientCallback from '../../nuclide-debugger-common/lib/ClientCallback';
import {Subject} from 'rxjs';

export type UserMessageType = 'notification' | 'console' | 'outputWindow';

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
export class ClientCallback extends BaseClientCallback {
  sendUserMessage(type: UserMessageType, message: Object): void {
    logger.debug(`sendUserMessage(${type}): ${JSON.stringify(message)}`);
    switch (type) {
      case 'notification':
        this._atomNotificationObservable.next({
          type: message.type,
          message: message.message,
        });
        break;
      case 'console':
      case 'outputWindow':
        this.sendUserOutputMessage(JSON.stringify(message));
        break;
      default:
        logger.error(`Unknown UserMessageType: ${type}`);
    }
  }

  replyWithError(id: number, error: string): void {
    this.replyToCommand(id, {}, error);
  }

  replyToCommand(id: number, result: Object, error: ?string): void {
    const value: Object = {id, result};
    if (error != null) {
      value.error = error;
    }
    sendJsonObject(this._serverMessageObservable, value);
  }

  sendServerMethod(method: string, params: ?Object) {
    sendJsonObject(
      this._serverMessageObservable,
      createMessage(method, params),
    );
  }
}

function sendJsonObject(subject: Subject<string>, value: Object): void {
  const message = JSON.stringify(value);
  logger.debug(`Sending JSON: ${message}`);
  subject.next(message);
}
