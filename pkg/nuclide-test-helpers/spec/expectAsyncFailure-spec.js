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

import {expectAsyncFailure} from '..';

describe('expectAsyncFailure', () => {
  it('fails when provided Promise succeeds', () => {
    const verify: any = jasmine.createSpy();
    waitsForPromise({shouldReject: true}, () => {
      return expectAsyncFailure(
        Promise.resolve('resolved, not rejected!'),
        verify,
      );
    });
    runs(() => {
      expect(verify.callCount).toBe(0);
    });
  });

  it('fails when provided Promise fails but with wrong error message', () => {
    let callCount = 0;
    function verify(error) {
      ++callCount;
      const expectedMessage = 'I failed badly.';
      if (error.message !== expectedMessage) {
        throw Error(`Expected '${expectedMessage}', but was ${error.message}.`);
      }
    }

    waitsForPromise({shouldReject: true}, () => {
      return expectAsyncFailure(Promise.reject(Error('I failed.')), verify);
    });
    runs(() => {
      expect(callCount).toBe(1);
    });
  });

  it('succeeds when provided Promise fails in the expected way', () => {
    let callCount = 0;
    function verify(error) {
      ++callCount;
      const expectedMessage = 'I failed badly.';
      if (error.message !== expectedMessage) {
        throw Error(`Expected '${expectedMessage}', but was ${error.message}.`);
      }
    }

    waitsForPromise({shouldReject: false}, () => {
      return expectAsyncFailure(
        Promise.reject(Error('I failed badly.')),
        verify,
      );
    });
    runs(() => {
      expect(callCount).toBe(1);
    });
  });
});
