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

import type {ClientCallback} from '../lib/ClientCallback';

import ConsoleHandler from '../lib/ConsoleHandler';

describe('debugger-php-rpc ConsoleHandler', () => {
  let clientCallback: any;
  let handler: any;
  let observableSpy: any;

  beforeEach(() => {
    observableSpy = jasmine.createSpyObj('serverMessageObservable', [
      'onNext',
      'onCompleted',
    ]);
    clientCallback = ((jasmine.createSpyObj('clientCallback', [
      'replyToCommand',
      'replyWithError',
      'sendServerMethod',
      'getServerMessageObservable',
    ]): any): ClientCallback);
    // $FlowIssue -- instance method on object.
    clientCallback.getServerMessageObservable = jasmine
      .createSpy('getServerMessageObservable')
      .andReturn(observableSpy);
    handler = new ConsoleHandler(clientCallback);
  });

  it('enable', () => {
    waitsForPromise(async () => {
      await handler.handleMethod(1, 'enable');
      expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
        1,
        {},
        undefined,
      );
    });
  });

  it('disable', () => {
    waitsForPromise(async () => {
      await handler.handleMethod(2, 'disable');
      expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
        2,
        {},
        undefined,
      );
    });
  });

  it('clearMessages', () => {
    waitsForPromise(async () => {
      await handler.handleMethod(3, 'clearMessages');
      expect(clientCallback.sendServerMethod).toHaveBeenCalledWith(
        'Console.messagesCleared',
        undefined,
      );
    });
  });

  it('unknown', () => {
    waitsForPromise(async () => {
      await handler.handleMethod(4, 'unknown');
      expect(clientCallback.replyWithError).toHaveBeenCalledWith(
        4,
        jasmine.any(String),
      );
    });
  });
});
