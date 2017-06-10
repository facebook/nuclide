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

import type {GroupedResults} from '../lib/searchResultHelpers';

import {
  filterEmptyResults,
  flattenResults,
  getOuterResults,
} from '../lib/searchResultHelpers';

const SEARCH_RESULTS_FIXTURE: GroupedResults = {
  searchService: {
    results: {
      shouldNotAppearInOutputFolder: {
        results: [],
        loading: false,
        error: null,
      },
      folderB: {
        results: [{path: 'foo'}],
        loading: false,
        error: null,
      },
    },
    title: 'searchService',
    priority: 0,
    totalResults: 1,
  },
  symbolService: {
    results: {
      folderA: {
        results: [{path: 'bar'}],
        loading: false,
        error: null,
      },
      shouldNotAppearInOutputFolder: {
        results: [],
        loading: false,
        error: null,
      },
    },
    title: 'symbolService',
    priority: 0,
    totalResults: 1,
  },
  shouldNotAppearInOutputService: {
    results: {
      folderA: {
        results: [],
        loading: false,
        error: null,
      },
      folderB: {
        results: [],
        loading: false,
        error: null,
      },
    },
    title: 'shouldNotAppearInOutputService',
    priority: 0,
    totalResults: 0,
  },
};

describe('searchResultHelper', () => {
  describe('emptyResults', () => {
    it('does not include empty folders', () => {
      const filteredResults: GroupedResults = filterEmptyResults(
        SEARCH_RESULTS_FIXTURE,
      );
      expect(filteredResults).toEqual({
        searchService: {
          results: {
            folderB: {
              results: [{path: 'foo'}],
              loading: false,
              error: null,
            },
          },
        },
        symbolService: {
          results: {
            folderA: {
              results: [{path: 'bar'}],
              loading: false,
              error: null,
            },
          },
        },
      });
    });
  });

  describe('flattenResults', () => {
    it('returns an array of flattened results', () => {
      expect(flattenResults(SEARCH_RESULTS_FIXTURE)).toEqual([
        {path: 'foo'},
        {path: 'bar'},
      ]);
    });
  });

  describe('getOuterResults', () => {
    it('works with top', () => {
      const topOuterResults = getOuterResults('top', SEARCH_RESULTS_FIXTURE);
      expect(topOuterResults).toEqual({
        serviceName: 'searchService',
        directoryName: 'folderB',
        results: [{path: 'foo'}],
      });
    });

    it('works with bottom', () => {
      const topOuterResults = getOuterResults('bottom', SEARCH_RESULTS_FIXTURE);
      expect(topOuterResults).toEqual({
        serviceName: 'symbolService',
        directoryName: 'folderA',
        results: [{path: 'bar'}],
      });
    });
  });
});
