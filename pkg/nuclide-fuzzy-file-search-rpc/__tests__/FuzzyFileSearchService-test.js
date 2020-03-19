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
import * as pathSearch from '../lib/FileSearchProcess';
import {queryFuzzyFile, isFuzzySearchAvailableFor} from '..';

// $FlowIgnore #yolo
pathSearch.fileSearchForDirectory = () => {
  return Promise.resolve({
    query() {
      return Promise.resolve([]);
    },
    dispose() {},
  });
};

describe('FuzzyFileSearchService.isFuzzySearchAvailableFor', () => {
  it('can search existing directories', async () => {
    expect(await isFuzzySearchAvailableFor(__dirname)).toBe(true);
  });

  it('cant search non-existing directories', async () => {
    // eslint-disable-next-line no-path-concat
    const nonExistentPath = __dirname + 'xxx';
    expect(await isFuzzySearchAvailableFor(nonExistentPath)).toBe(false);
  });

  it("doesn't get confused by atom:// paths", async () => {
    expect(await isFuzzySearchAvailableFor('atom://about')).toBe(false);
  });
});

describe('FuzzyFileSearchService.queryFuzzyFile', () => {
  it('finds a file in a directory that exists', async () => {
    // This test can't actually perform a search because path-search
    // uses watchman and we don't have a good way to mock dependencies.
    const fileSearchResults = await queryFuzzyFile({
      rootDirectory: __dirname,
      queryString: 'anything',
      ignoredNames: [],
      preferCustomSearch: false,
      context: null,
    });
    expect(fileSearchResults).toEqual([]);
  });
});
