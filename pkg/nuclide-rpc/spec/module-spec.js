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

import {createProxyFactory, __test__} from '../lib/main';
import {addMatchers} from '../../nuclide-test-helpers';

describe('Module public API.', () => {
  beforeEach(function() {
    __test__.proxiesCache.clear();
    addMatchers(this);
  });

  it('Creates a remote proxy for a module, caching the intermediate results.', () => {
    const fakeClient: any = {};
    const defFile = require.resolve('./fixtures/FunctionService.def');

    expect(__test__.proxiesCache.size).toBe(0);

    const factory = createProxyFactory('FunctionService', false, defFile, []);
    const proxy = factory(fakeClient);

    expect(Object.keys(proxy)).diffJson([
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
