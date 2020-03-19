/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import humanizePath from '../humanizePath';

describe('humanizePath', () => {
  it("includes the root name if there's more than one", () => {
    expect(humanizePath('/a/b/c', {rootPaths: ['/a', '/d']})).toBe('a/b/c');
  });

  it("doesn't care if the rootPaths have trailing slashes", () => {
    // Atom hasn't always been consistent about this.
    expect(humanizePath('/a/b/c', {rootPaths: ['/a/', '/d/']})).toBe('a/b/c');
  });

  it("doesn't include the root name if there's only one", () => {
    expect(humanizePath('/a/b/c', {rootPaths: ['/a']})).toBe('b/c');
  });

  it("returns the root name if it's a root path", () => {
    expect(humanizePath('/a/', {rootPaths: ['/a', '/d']})).toBe('a/');
  });

  it("returns the absolute path if the file isn't in an open project root", () => {
    expect(humanizePath('/a/b/c', {rootPaths: []})).toBe('/a/b/c');
    expect(humanizePath('/a/b/c', {rootPaths: ['/d']})).toBe('/a/b/c');
  });

  it('doesn\'t use ".." if the file is above the root', () => {
    expect(humanizePath('/a/b/c', {rootPaths: ['/a/b/c/d']})).toBe('/a/b/c');
  });

  it("includes a trailing slash if you say it's a directory", () => {
    expect(humanizePath('/a/b/c', {isDirectory: true, rootPaths: []})).toBe(
      '/a/b/c/',
    );
  });

  it('normalizes', () => {
    expect(humanizePath('/a/b//c//', {rootPaths: []})).toBe('/a/b/c/');
  });
});
