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

import RemoteDirectorySearcher from '../lib/RemoteDirectorySearcher';

describe('RemoteDirectorySearcher.processPaths', () => {
  it('expands basename searches to the whole directory', () => {
    expect(RemoteDirectorySearcher.processPaths('a/b/c', ['c/d', 'c'])).toEqual(
      [],
    );
  });

  it('tries subdirs for basename searches', () => {
    expect(
      RemoteDirectorySearcher.processPaths('a/b/c', ['c/d', 'c/e']),
    ).toEqual(['c/d', 'd', 'c/e', 'e']);
  });

  it('does not expand regular searches', () => {
    expect(RemoteDirectorySearcher.processPaths('a/b/c', ['a', 'b'])).toEqual([
      'a',
      'b',
    ]);
  });
});
