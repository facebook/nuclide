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
import {computeDisplayPaths} from '../ChangedFilesList';

describe('computeDisplayPaths', () => {
  it('should compute depth 1 paths correctly', () => {
    const input = ['/a/b.js', '/a/c.js'];
    const expected = ['b.js', 'c.js'];
    const actual = computeDisplayPaths(input);
    expect(actual).toEqual(expected);
  });

  it('should compute depth 2 paths correctly', () => {
    const input = ['/a/b.js', '/c/b.js'];
    const expected = ['a/b.js', 'c/b.js'];
    const actual = computeDisplayPaths(input);
    expect(actual).toEqual(expected);
  });

  it('should compute a mix of depths 1 to 5 paths correctly', () => {
    const input = [
      '/a/b/c/d/e.js',
      '/z/b/c/d/e.js',
      'a/y/z/e.js',
      'a/y/e.js',
      'a/z/e.js',
      'a/f.js',
    ];
    const expected = [
      'a/b/c/d/e.js',
      'z/b/c/d/e.js',
      'y/z/e.js',
      'y/e.js',
      'a/z/e.js',
      'f.js',
    ];
    const actual = computeDisplayPaths(input);
    expect(actual).toEqual(expected);
  });

  it('should honor the max depth argument', () => {
    const maxDepth = 2;
    const input = ['/a/b/c/d/e.js', '/z/b/c/d/e.js'];
    const expected = ['d/e.js', 'd/e.js'];
    const actual = computeDisplayPaths(input, maxDepth);
    expect(actual).toEqual(expected);
  });

  it('should handle empty input', () => {
    const input = [];
    const expected = [];
    const actual = computeDisplayPaths(input);
    expect(actual).toEqual(expected);
  });

  it('should handle different path separators', () => {
    const input = ['/a/b/c.js', 'C:\\z\\b\\c.js'];
    const expected = ['a/b/c.js', 'z\\b\\c.js'];
    const actual = computeDisplayPaths(input);
    expect(actual).toEqual(expected);
  });

  it('should handle a realistic scenario path separators', () => {
    const input = [
      'nuclide://data/users/x/fbsource/fbcode/foo/bar.js',
      'nuclide://data/users/x/fbsource/fbcode/bar/bar.js',
      '/Users/y/fbsource/fbcode/foo/bar.js',
      '/Users/y/fbsource/fbcode/bar/bar.js',
    ];
    const expected = [
      'x/fbsource/fbcode/foo/bar.js',
      'x/fbsource/fbcode/bar/bar.js',
      'y/fbsource/fbcode/foo/bar.js',
      'y/fbsource/fbcode/bar/bar.js',
    ];
    const actual = computeDisplayPaths(input);
    expect(actual).toEqual(expected);
  });
});
