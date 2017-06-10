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

import waitsForPromise from '../lib/waitsForPromise';

function testFlowtypedFunction(arg: number): number {
  return arg;
}

describe('Jasmine transpile test suite', () => {
  it('test transpiler worked as exepcted', () => {
    const promise = Promise.resolve('test');
    expect(typeof promise).toEqual('object');
    expect(testFlowtypedFunction(1)).toEqual(1);
  });
});

describe('Jasmine environment', () => {
  it('sets the correct NODE_ENV', () => {
    expect(process.env.NODE_ENV).toEqual('test');
  });
});

describe('Jasmine waitsForPromise test suite', () => {
  beforeEach(() => jasmine.useRealClock());

  it('test waitsForPromise worked as expected on a resolved promise', () => {
    waitsForPromise(async () => {
      const promise = Promise.resolve('test');
      const result = await promise;
      expect(result).toEqual('test');
    });
  });

  it('test waitsForPromise worked as expected on a rejected promise', () => {
    waitsForPromise({shouldReject: true}, () =>
      Promise.reject(new Error('test')),
    );
  });

  it('test waitsForPromise worked as expected on a customized timeout', () => {
    // This is more than default timeout of 5 seconds.
    waitsForPromise({shouldReject: false, timeout: 7 * 1000}, () => {
      return new Promise((resolve, reject) => {
        setTimeout(resolve, 6 * 1000);
      });
    });
  });
});
