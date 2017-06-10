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
  MessageTranslator as MessageTranslatorType,
} from '../lib/MessageTranslator';
import type {ClientCallback} from '../lib/ClientCallback';

import {uncachedRequire, clearRequireCache} from '../../nuclide-test-helpers';

describe('debugger-php-rpc MessageTranslator', () => {
  let connectionMultiplexer: any;
  let ConnectionMultiplexer: any;
  let translater: any;
  let clientCallback: any;

  beforeEach(() => {
    connectionMultiplexer = jasmine.createSpyObj('connectionMultiplexer', [
      'dispose',
      'onStatus',
      'onNotification',
      'onConnectionError',
    ]);
    const disposable = {dispose: () => {}};
    connectionMultiplexer.onStatus = jasmine
      .createSpy('onStatus')
      .andReturn(disposable);
    connectionMultiplexer.onNotification = jasmine
      .createSpy('onNotification')
      .andReturn(disposable);
    ConnectionMultiplexer = spyOn(
      require('../lib/ConnectionMultiplexer'),
      'ConnectionMultiplexer',
    ).andReturn(connectionMultiplexer);
    clientCallback = jasmine.createSpyObj('clientCallback', [
      'replyWithError',
      'replyToCommand',
      'sendServerMethod',
    ]);
    const {MessageTranslator} = ((uncachedRequire(
      require,
      '../lib/MessageTranslator',
    ): any): {MessageTranslator: Class<MessageTranslatorType>});
    translater = new MessageTranslator(((clientCallback: any): ClientCallback));
  });

  afterEach(() => {
    jasmine.unspy(
      require('../lib/ConnectionMultiplexer'),
      'ConnectionMultiplexer',
    );
    clearRequireCache(require, '../lib/MessageTranslator');
  });

  it('constructor', () => {
    expect(ConnectionMultiplexer).toHaveBeenCalledWith(clientCallback);
    expect(connectionMultiplexer.onStatus).toHaveBeenCalled();
  });

  it('handleCommand', () => {
    waitsForPromise(async () => {
      await translater.handleCommand('{"id": 1, "method": "Page.enable"}');
      expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
        1,
        {},
        undefined,
      );
    });
  });

  it('handleCommand - bad domain', () => {
    waitsForPromise(async () => {
      await translater.handleCommand('{"id": 1, "method": "foo.enable"}');
      expect(clientCallback.replyWithError).toHaveBeenCalledWith(
        1,
        'Unknown domain: {"id": 1, "method": "foo.enable"}',
      );
    });
  });

  it('dispose', () => {
    translater.dispose();
    expect(connectionMultiplexer.dispose).toHaveBeenCalledWith();
  });
});
