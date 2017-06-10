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

describe('fuzzy-native', () => {
  it('can be required', () => {
    const fuzzyNative = require('..');
    const matcher = new fuzzyNative.Matcher(['test']);
    // The fallback uses a different scoring mechanism, so this will fail
    // if the native module failed to load.
    expect(matcher.match('test')).toEqual([{value: 'test', score: 1}]);
  });
});
