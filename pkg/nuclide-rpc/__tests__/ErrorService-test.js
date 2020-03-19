/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {ServiceTester} from '../__mocks__/ServiceTester';
import waitsFor from '../../../jest/waits_for';

describe('ErrorServer', () => {
  let testHelper;
  let service;
  beforeEach(async () => {
    testHelper = new ServiceTester();
    invariant(testHelper);
    await testHelper.start(
      [
        {
          name: 'ErrorService',
          definition: nuclideUri.join(
            __dirname,
            '../__mocks__/ErrorService.def',
          ),
          implementation: nuclideUri.join(
            __dirname,
            '../__mocks__/ErrorService.js',
          ),
        },
      ],
      'error_protocol',
    );

    invariant(testHelper);
    service = testHelper.getRemoteService('ErrorService');
  });

  it('ErrorService - error message', async () => {
    try {
      invariant(service);
      await service.promiseError('msg');
      expect(false).toBe(true);
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect(e.message).toEqual('msg');
      expect(e.rpcMessage).toEqual(
        '{"protocol":"error_protocol","type":"call","method":"ErrorService/promiseError","id":1,"args":{"message":"msg"}}',
      );
    }
  });

  it('ErrorService - error string', async () => {
    try {
      invariant(service);
      await service.promiseErrorString('msg');
      expect(false).toBe(true);
    } catch (e) {
      expect(e).toBe('msg');
    }
  });

  it('ErrorService - error undefined', async () => {
    try {
      invariant(service);
      await service.promiseErrorUndefined();
      expect(false).toBe(true);
    } catch (e) {
      expect(e).toBe(undefined);
    }
  });

  it('ErrorService - error code', async () => {
    try {
      invariant(service);
      await service.promiseErrorCode(42);
      expect(false).toBe(true);
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect(e.code).toBe(42);
    }
  });

  it('ErrorService - observable error.message', () => {
    invariant(service);
    const o = service.observableError('msg').refCount();
    let completed = false;

    o.subscribe(
      () => {
        expect(true).toBe(false);
      },
      e => {
        expect(e.message).toEqual('msg');
        expect(e.rpcMessage).toEqual(
          '{"protocol":"error_protocol","type":"call","method":"ErrorService/observableError","id":1,"args":{"message":"msg"}}',
        );
        completed = true;
      },
      () => {
        expect(true).toBe(false);
      },
    );

    waitsFor(() => completed);
  });

  it('ErrorService - observable message', () => {
    invariant(service);
    const o = service.observableErrorString('msg').refCount();
    let completed = false;

    o.subscribe(
      () => {
        expect(true).toBe(false);
      },
      e => {
        expect(e).toBe('msg');
        completed = true;
      },
      () => {
        expect(true).toBe(false);
      },
    );

    waitsFor(() => completed);
  });

  it('ErrorService - observable undefined', () => {
    invariant(service);
    const o = service.observableErrorUndefined().refCount();
    let completed = false;

    o.subscribe(
      () => {
        expect(true).toBe(false);
      },
      e => {
        expect(e).toBe(undefined);
        completed = true;
      },
      () => {
        expect(true).toBe(false);
      },
    );

    waitsFor(() => completed);
  });

  it('ErrorService - observable code', () => {
    invariant(service);
    const o = service.observableErrorCode(42).refCount();
    let completed = false;

    o.subscribe(
      () => {
        expect(true).toBe(false);
      },
      e => {
        expect(e.code).toBe(42);
        completed = true;
      },
      () => {
        expect(true).toBe(false);
      },
    );

    waitsFor(() => completed);
  });

  afterEach(() => {
    invariant(testHelper);
    return testHelper.stop();
  });
});
