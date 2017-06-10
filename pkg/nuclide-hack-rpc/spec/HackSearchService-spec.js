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

import {convertSearchResults, parseQueryString} from '../lib/SymbolSearch';

describe('Hack Symbol Search', () => {
  describe('convertSearchResults', () => {
    it('empty results are returned when getSearchResults() returns null', () => {
      expect(convertSearchResults('/hackroot', null)).toEqual([]);
    });
  });

  describe('parseQueryString', () => {
    it('normal query', () => {
      expect(parseQueryString('asdf')).toEqual({
        queryString: 'asdf',
        searchPostfix: null,
      });
    });

    it('function query', () => {
      expect(parseQueryString('@asdf')).toEqual({
        queryString: 'asdf',
        searchPostfix: '-function',
      });
    });

    it('class query', () => {
      expect(parseQueryString('#asdf')).toEqual({
        queryString: 'asdf',
        searchPostfix: '-class',
      });
    });

    it('constant query', () => {
      expect(parseQueryString('%asdf')).toEqual({
        queryString: 'asdf',
        searchPostfix: '-constant',
      });
    });
  });
});
