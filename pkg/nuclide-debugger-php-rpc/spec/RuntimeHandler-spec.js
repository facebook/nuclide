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

import type {ConnectionMultiplexer} from '../lib/ConnectionMultiplexer';
import type {ClientCallback} from '../lib/ClientCallback';

import {RuntimeHandler} from '../lib/RuntimeHandler';

describe('debugger-php-rpc RuntimeHandler', () => {
  let clientCallback: any;
  let connectionMultiplexer: any;
  let handler: any;
  let observableSpy: any;

  beforeEach(() => {
    observableSpy = jasmine.createSpyObj('serverMessageObservable', [
      'onNext',
      'onCompleted',
    ]);
    connectionMultiplexer = ((jasmine.createSpyObj('connectionMultiplexer', [
      'getProperties',
      'runtimeEvaluate',
    ]): any): ConnectionMultiplexer);
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
    handler = new RuntimeHandler(clientCallback, connectionMultiplexer);
  });

  it('enable', () => {
    handler.handleMethod(1, 'enable');
    expect(
      clientCallback.sendServerMethod,
    ).toHaveBeenCalledWith('Runtime.executionContextCreated', {
      context: {
        id: 1,
        frameId: 'Frame.0',
        name: 'hhvm: TODO: mangle in pid, idekey, script from connection',
      },
    });
  });

  it('getProperties', () => {
    waitsForPromise(async () => {
      connectionMultiplexer.getProperties = jasmine
        .createSpy('getProperties')
        .andReturn(Promise.resolve('the-result'));

      const objectId = 'object-id';
      const ownProperties = false;
      const generatePreview = false;
      const accessorPropertiesOnly = false;
      await handler.handleMethod(1, 'getProperties', {
        objectId,
        ownProperties,
        accessorPropertiesOnly,
        generatePreview,
      });
      expect(connectionMultiplexer.getProperties).toHaveBeenCalledWith(
        objectId,
      );
      expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
        1,
        {result: 'the-result'},
        undefined,
      );
    });
  });

  describe('evaluate', () => {
    const expression = 'evaluate-expression';

    beforeEach(() => {
      connectionMultiplexer.runtimeEvaluate = jasmine
        .createSpy('runtimeEvaluate')
        .andReturn(Promise.resolve('the-result'));
    });

    it('console', () => {
      waitsForPromise(async () => {
        await handler.handleMethod(1, 'evaluate', {
          expression,
          objectGroup: 'console',
        });
        expect(connectionMultiplexer.runtimeEvaluate).toHaveBeenCalledWith(
          expression,
        );
        expect(clientCallback.replyToCommand).toHaveBeenCalledWith(
          1,
          'the-result',
          undefined,
        );
      });
    });

    it('non-console', () => {
      waitsForPromise(async () => {
        await handler.handleMethod(1, 'evaluate', {
          expression,
          objectGroup: 'other',
        });
        expect(connectionMultiplexer.runtimeEvaluate).not.toHaveBeenCalled();
        expect(clientCallback.replyWithError).toHaveBeenCalledWith(
          1,
          jasmine.any(String),
        );
      });
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
