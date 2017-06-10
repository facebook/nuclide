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

import compareVersions from '../compareVersions';

describe('compareVersions', () => {
  it('compares two versions', () => {
    expect(compareVersions('9.2', '10.0')).toBe(-1);
  });

  it('compares versions with an unequal number of parts', () => {
    expect(compareVersions('9', '8.9')).toBe(1);
    expect(compareVersions('9', '9.1')).toBe(-1);
    expect(compareVersions('9', '9.0')).toBe(0);
  });

  it('compares numbers using version numbers and not decimal values', () => {
    expect(compareVersions('9.2', '9.10')).toBe(-1);
  });
});
