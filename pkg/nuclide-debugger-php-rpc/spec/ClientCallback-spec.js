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

import type {ClientCallback as ClientCallbackType} from '../lib/ClientCallback';

import {uncachedRequire, clearRequireCache} from '../../nuclide-test-helpers';

describe('debugger-php-rpc ClientCallback', () => {
  let clientCallback: any;
  let observableSpy: any;

  beforeEach(() => {
    observableSpy = jasmine.createSpyObj('serverMessageObservable', [
      'next',
      'complete',
    ]);
    spyOn(require('rxjs'), 'Subject').andReturn(observableSpy);
    spyOn(require('rxjs'), 'ReplaySubject').andReturn(observableSpy);
    const {ClientCallback} = ((uncachedRequire(
      require,
      '../lib/ClientCallback',
    ): any): {ClientCallback: () => ClientCallbackType});
    clientCallback = new ClientCallback();
  });

  afterEach(() => {
    clearRequireCache(require, '../lib/ClientCallback');
  });

  it('sendServerMethod: no args', () => {
    clientCallback.sendServerMethod('method1');
    expect(observableSpy.next).toHaveBeenCalledWith('{"method":"method1"}');
  });

  it('sendServerMethod: args', () => {
    clientCallback.sendServerMethod('method1', {arg1: 12});
    expect(observableSpy.next).toHaveBeenCalledWith(
      '{"method":"method1","params":{"arg1":12}}',
    );
  });

  it('replyWithError', () => {
    clientCallback.replyWithError(42, 'error-msg');
    expect(observableSpy.next).toHaveBeenCalledWith(
      '{"id":42,"result":{},"error":"error-msg"}',
    );
  });

  it('replyToCommand: no-error', () => {
    clientCallback.replyToCommand(42, {result: 'value'});
    expect(observableSpy.next).toHaveBeenCalledWith(
      '{"id":42,"result":{"result":"value"}}',
    );
  });

  it('replyToCommand: error', () => {
    clientCallback.replyToCommand(42, {result: 'value'}, 'error-msg');
    expect(observableSpy.next).toHaveBeenCalledWith(
      '{"id":42,"result":{"result":"value"},"error":"error-msg"}',
    );
  });

  it('sendUserMessage console', () => {
    const message = {
      type: 'error',
      message: 'error message',
    };
    clientCallback.sendUserMessage('notification', message);
    expect(observableSpy.next).toHaveBeenCalledWith(message);
  });

  it('dispose', () => {
    clientCallback.dispose();
    expect(observableSpy.complete).toHaveBeenCalled();
  });
});
