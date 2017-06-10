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
import {ClientCallback} from './ClientCallback';
import type {UserMessageType} from './ClientCallback';

export default class Handler {
  _domain: string;
  _clientCallback: ClientCallback;

  constructor(domain: string, clientCallback: ClientCallback) {
    this._domain = domain;
    this._clientCallback = clientCallback;
  }

  getDomain(): string {
    return this._domain;
  }

  handleMethod(id: number, method: string, params: Object): Promise<any> {
    throw new Error('absrtact');
  }

  unknownMethod(id: number, method: string, params: ?Object): void {
    const message =
      'Unknown chrome dev tools method: ' + this.getDomain() + '.' + method;
    logger.debug(message);
    this.replyWithError(id, message);
  }

  replyWithError(id: number, error: string): void {
    this._clientCallback.replyWithError(id, error);
  }

  replyToCommand(id: number, result: Object, error: ?string): void {
    this._clientCallback.replyToCommand(id, result, error);
  }

  sendMethod(method: string, params: ?Object): void {
    this._clientCallback.sendServerMethod(method, params);
  }

  sendUserMessage(type: UserMessageType, message: Object): void {
    this._clientCallback.sendUserMessage(type, message);
  }
}
