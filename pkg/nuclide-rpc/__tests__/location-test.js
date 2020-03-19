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
import {builtinLocation} from '../lib/builtin-types';
import {locationsEqual, locationToString} from '../lib/location';

const builtin2 = {
  type: 'builtin',
};

const loc1 = {
  type: 'source',
  fileName: 'file1',
  line: 42,
};

const loc2 = {
  type: 'source',
  fileName: 'file1',
  line: 42,
};

const loc3 = {
  type: 'source',
  fileName: 'file2',
  line: 42,
};

const loc4 = {
  type: 'source',
  fileName: 'file1',
  line: 43,
};

const loc5 = {
  type: 'source',
  fileName: 'file2',
  line: 43,
};

describe('Location', () => {
  it('toString', () => {
    expect(locationToString(builtinLocation)).toBe('<builtin>');
    expect(locationToString(loc1)).toBe('file1(42)');
  });

  it('equals', () => {
    expect(locationsEqual(builtinLocation, builtin2)).toBe(true);
    expect(locationsEqual(builtinLocation, loc1)).toBe(false);

    expect(locationsEqual(loc1, loc2)).toBe(true);
    expect(locationsEqual(loc1, loc3)).toBe(false);
    expect(locationsEqual(loc1, loc4)).toBe(false);
    expect(locationsEqual(loc1, loc5)).toBe(false);
  });
});
