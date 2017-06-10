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

import type {PhpDebuggerService as PhpDebuggerServiceType} from '..';

import {uncachedRequire, clearRequireCache} from '../../nuclide-test-helpers';

describe('debugger-php-rpc proxy', () => {
  let MessageTranslator: any;
  let PhpDebuggerService: any;
  let translater: any;
  let clientCallback: any;

  beforeEach(() => {
    translater = jasmine.createSpyObj('MessageTranslator', [
      'onSessionEnd',
      'dispose',
      'handleCommand',
    ]);
    MessageTranslator = spyOn(
      require('../lib/MessageTranslator'),
      'MessageTranslator',
    ).andCallFake(callback => {
      clientCallback = callback;
      return translater;
    });
    // $FlowFixMe override instance method.
    MessageTranslator.handleCommand = jasmine
      .createSpy('handleCommand')
      .andReturn(Promise.resolve());

    PhpDebuggerService = ((uncachedRequire(
      require,
      '../lib/PhpDebuggerService',
    ): any): {PhpDebuggerService: () => PhpDebuggerServiceType})
      .PhpDebuggerService;
  });

  afterEach(() => {
    jasmine.unspy(require('../lib/MessageTranslator'), 'MessageTranslator');
    clearRequireCache(require, '../lib/PhpDebuggerService');
  });

  it('attach', () => {
    const port = 7782;

    const config = {
      xdebugAttachPort: port,
      pid: null,
      idekeyRegex: null,
      scriptRegex: null,
      targetUri: '/tmp/foo.php',
    };
    spyOn(require('../lib/config'), 'setConfig');
    spyOn(require('../lib/config'), 'getConfig').andReturn(config);

    waitsForPromise(async () => {
      const proxy = new PhpDebuggerService();

      const onServerMessageNotify = jasmine.createSpy('onServerMessageNotify');
      const onServerMessageError = jasmine.createSpy('onServerMessageError');
      const onSessionEnd = jasmine.createSpy('onSessionEnd');
      proxy
        .getServerMessageObservable()
        .refCount()
        .subscribe(onServerMessageNotify, onServerMessageError, onSessionEnd);

      const onNotificationMessage = jasmine.createSpy('onNotificationMessage');
      const onNotificationError = jasmine.createSpy('onNotificationError');
      const onNotificationEnd = jasmine.createSpy('onNotificationEnd');
      proxy
        .getNotificationObservable()
        .refCount()
        .subscribe(
          onNotificationMessage,
          onNotificationError,
          onNotificationEnd,
        );

      const connectionPromise = proxy.debug(config);

      const result = await connectionPromise;

      expect(require('../lib/config').setConfig).toHaveBeenCalled();
      expect(MessageTranslator).toHaveBeenCalledWith(clientCallback);
      expect(translater.onSessionEnd).toHaveBeenCalledWith(
        jasmine.any(Function),
      );

      expect(result).toBe('HHVM connected');

      const command = {command: 42};
      proxy.sendCommand(command);
      expect(translater.handleCommand).toHaveBeenCalledWith(command);

      clientCallback.replyToCommand(43, 'reply message');
      expect(onServerMessageNotify).toHaveBeenCalledWith(
        '{"id":43,"result":"reply message"}',
      );

      await proxy.dispose();
      expect(onSessionEnd).toHaveBeenCalled();
      expect(translater.dispose).toHaveBeenCalled();
    });
  });
});
