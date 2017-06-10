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

import typeof * as TestModuleType from './toBeTested';

import {uncachedRequire, clearRequireCache} from '..';

describe('Mocking Imports test suite', () => {
  // Tests ToBeTested.functionToTest while mocking imported function toBeMocked.
  it('Mocking imported dependencies', () => {
    // 1 - First mock all functions imported by the module under test
    const mock = spyOn(require('./toBeMocked'), 'importedFunction').andReturn(
      45,
    );

    // 2 - Do an uncachedRequire of the module to test
    // Note the 'import typeof * as ... ' above to get type checking
    // for the functions to be tested.
    // You may want to put steps 1 & 2 in your beforeEach.
    const moduleToTest: TestModuleType = (uncachedRequire(
      require,
      './toBeTested',
    ): any);

    // 3 - Perform your test
    const result = moduleToTest.functionToTest();
    expect(mock).toHaveBeenCalledWith(42);
    expect(result).toEqual(45);

    // 4 - Reset the require cache so your mocks don't get used for other tests.
    // You may want to put this in your afterEach.
    clearRequireCache(require, './toBeTested');
  });
});
