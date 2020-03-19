/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import {JAVASCRIPT_WORD_REGEX, filterResultsByPrefix, shouldFilter} from '..';

import type {Completion} from '../../nuclide-language-service/lib/LanguageService';

describe('JAVASCRIPT_WORD_REGEX', () => {
  // For brevity in specs.
  function matches(s) {
    return s.match(JAVASCRIPT_WORD_REGEX);
  }

  it('should match numbers', () => {
    expect(matches('454     1231')).toEqual(['454', '1231']);
  });

  it('should match identifiers', () => {
    expect(matches('hello these are $_words___A (mostly)')).toEqual([
      'hello',
      'these',
      'are',
      '$_words___A',
      'mostly',
    ]);
  });

  ['`', "'", '"'].forEach(delimiter => {
    describe(`matching strings delimited by ${delimiter}.`, () => {
      // For brevity.
      const d = delimiter;
      it('should match a simple string', () => {
        expect(
          matches(`${d}asdf asdf${d} identifier ${d}another string${d}`),
        ).toEqual([
          `${d}asdf asdf${d}`,
          'identifier',
          `${d}another string${d}`,
        ]);
      });

      it('should handle escaped delimiters', () => {
        expect(matches(`id ${d}foo \\${d} bar${d} another id`)).toEqual([
          'id',
          `${d}foo \\${d} bar${d}`,
          'another',
          'id',
        ]);
        expect(matches(`${d}\\${d}${d}`)).toEqual([`${d}\\${d}${d}`]);
      });

      it('should handle backslashes in front of other characters', () => {
        expect(matches(`${d}\\4asdf foo${d}`)).toEqual([`${d}\\4asdf foo${d}`]);
        expect(matches(`${d}\\\\${d}`)).toEqual([`${d}\\\\${d}`]);
      });
    });
  });
});

describe('shouldFilter', () => {
  function fakeRequest(prefix: string): atom$AutocompleteRequest {
    // Right now shouldFilter only uses the prefix. If it changes this will need to be updated.
    return ({prefix}: any);
  }

  it('should filter after a dot', () => {
    expect(shouldFilter(fakeRequest('.'), fakeRequest('f'), 1)).toBe(true);
  });

  it('should filter after a dot even if the next prefix is more than one character', () => {
    expect(shouldFilter(fakeRequest('.'), fakeRequest('fo'), 2)).toBe(true);
  });

  it('should not filter after a dot if number of chars typed exceeds prefix length', () => {
    expect(shouldFilter(fakeRequest('.'), fakeRequest('fo'), 3)).toBe(false);
  });

  it('should filter when the prefix is one character longer and a valid identifier', () => {
    expect(shouldFilter(fakeRequest('asdf'), fakeRequest('asdfg'), 1)).toBe(
      true,
    );
    expect(shouldFilter(fakeRequest('_9asdf'), fakeRequest('_9asdf$'), 1)).toBe(
      true,
    );
  });

  it("should not filter if the current prefix doesn't start with the last prefix", () => {
    expect(shouldFilter(fakeRequest('asdf'), fakeRequest('bsdfg'), 1)).toBe(
      false,
    );
  });

  it('should not filter if the prefix is not a valid identifier', () => {
    expect(shouldFilter(fakeRequest('a-df'), fakeRequest('a-dfg'), 1)).toBe(
      false,
    );
    expect(shouldFilter(fakeRequest('9asdf'), fakeRequest('9asdfg'), 1)).toBe(
      false,
    );
  });

  it('should filter if the current prefix is more than one character longer', () => {
    expect(shouldFilter(fakeRequest('asdf'), fakeRequest('asdfgh'), 2)).toBe(
      true,
    );
  });

  it('should not filter if number of chars typed does not match prefix length difference', () => {
    expect(shouldFilter(fakeRequest('asdf'), fakeRequest('asdfgh'), 3)).toBe(
      false,
    );
  });

  // If autocomplete is activated manually (ctrl+space), you can get a blank prefix for the first
  // request. Then, we should filter when the first character is typed.
  it('should filter on the first character typed', () => {
    expect(shouldFilter(fakeRequest(''), fakeRequest('a'), 1)).toBe(true);
  });
});

describe('updateResults', () => {
  let prefix: string = (null: any);

  let resultsToUpdate: Array<Completion>;

  beforeEach(() => {
    const resultNames = [
      'Foo',
      'foo',
      'Bar',
      'BigLongNameTwo',
      'BigLongNameOne',
    ];
    resultsToUpdate = resultNames.map(name => ({
      displayText: name,
      type: 'foo',
    }));
  });

  function run() {
    return filterResultsByPrefix(prefix, {
      isIncomplete: false,
      items: resultsToUpdate,
    });
  }

  function getNames() {
    const results = run();
    return results == null
      ? null
      : results.items.map(result => result.displayText);
  }

  it('should not filter suggestions if the prefix is a .', () => {
    prefix = '.';
    expect(getNames()).toEqual([
      'Foo',
      'foo',
      'Bar',
      'BigLongNameTwo',
      'BigLongNameOne',
    ]);
  });

  it('should filter suggestions by the prefix', () => {
    prefix = 'bln';
    expect(getNames()).toEqual(['BigLongNameTwo', 'BigLongNameOne']);
  });

  it('should not filter suggestions if the prefix is not a valid id', () => {
    prefix = '{';
    expect(getNames()).toEqual([
      'Foo',
      'foo',
      'Bar',
      'BigLongNameTwo',
      'BigLongNameOne',
    ]);
  });

  it('should rank better matches higher', () => {
    prefix = 'one';
    expect(getNames()).toEqual(['BigLongNameOne', 'BigLongNameTwo']);
  });
});
