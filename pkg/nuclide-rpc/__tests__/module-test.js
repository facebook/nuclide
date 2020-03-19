/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import {createProxyFactory, __test__} from '../lib/main';

describe('Module public API.', () => {
  beforeEach(() => {
    __test__.proxiesCache.clear();
  });

  it('Creates a remote proxy for a module, caching the intermediate results.', () => {
    const fakeClient: any = {};
    const defFile = require.resolve(
      '../__mocks__/fixtures/FunctionService.def',
    );

    expect(__test__.proxiesCache.size).toBe(0);

    const factory = createProxyFactory('FunctionService', false, defFile, []);
    const proxy = factory(fakeClient);

    expect(Object.keys(proxy)).toEqual([
      'TestFunctionA',
      'TestFunctionB',
      'TestFunctionC',
      'TestFunctionD',
      'ReturnAlias',
    ]);

    // Expect that createProxyFactory added files to the cache.
    expect(__test__.proxiesCache.size).toBe(1);
  });
});
