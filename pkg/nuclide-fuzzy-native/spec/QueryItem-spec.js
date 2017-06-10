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

import invariant from 'assert';
import QueryItem from '../lib/QueryItem';

describe('QueryItem', () => {
  describe('"Hello"', () => {
    const item = new QueryItem('Hello');

    it('should return 0 for empty queries', () => {
      expect(item.score('')).toEqual({
        score: 0,
        value: 'Hello',
        matchIndexes: [],
      });
    });

    it('should return null on no match', () => {
      expect(item.score('z')).toBe(null);
    });

    it('should return null on non-sequential matches', () => {
      expect(item.score('lh')).toBe(null);
    });

    it('should ignore query case', () => {
      const score1 = item.score('He');
      const score2 = item.score('he');
      invariant(score1);
      invariant(score2);
      expect(score1.score).toEqual(score2.score);
    });

    it('should prefer matches where the letters are closer together', () => {
      const score1 = item.score('he');
      const score2 = item.score('hl');
      const score3 = item.score('ho');
      invariant(score1);
      invariant(score2);
      invariant(score3);
      expect(score1.score).toBeLessThan(score2.score);
      expect(score2.score).toBeLessThan(score3.score);
    });
  });

  describe('Path Separator', () => {
    const item = new QueryItem('He/y/Hello');

    // TODO match indices not yet implemented. These are not provided by the FBIDE algorithm.
    // eslint-disable-next-line jasmine/no-disabled-tests
    xit('should prefer matches after the last path separator', () => {
      const score = item.score('h');
      invariant(score);
      expect(score.matchIndexes).toEqual([5]);
    });

    it('should return null if no matches appeared after the last path separator', () => {
      expect(item.score('hey')).toBe(null);
    });

    it('should not be able to match characters before the separator', () => {
      expect(item.score('heyh')).toBe(null);
    });
  });

  describe('Misc', () => {
    // TODO match indices not yet implemented. These are not provided by the FBIDE algorithm.
    // eslint-disable-next-line jasmine/no-disabled-tests
    xit('should prefer matches with an initialism', () => {
      const item = new QueryItem('AbBa');
      const score = item.score('ab');
      invariant(score);
      expect(score.matchIndexes).toEqual([0, 2]);
    });

    it('should be able to fall back to substring match when an initialism skip fails', () => {
      const item = new QueryItem('AbBa');

      // If the query could initially trigger a skip then fail, still treturn a result.
      expect(item.score('bb')).not.toBe(null);
    });
  });
});

import {__test__} from '../lib/QueryItem';
const {
  checkIfMatchesCamelCaseLetters,
  isLetterImportant,
  importantCharactersForString,
  scoreCommonSubsequence,
} = __test__;

describe('checkIfMatchesCamelCaseLetters', () => {
  it('matches when all letters in `needle` are present as uppercase letters in `haystack`', () => {
    expect(checkIfMatchesCamelCaseLetters('fbide', 'fbide')).toBe(false);
    expect(checkIfMatchesCamelCaseLetters('fbide', 'FBIDE')).toBe(true);
    expect(
      checkIfMatchesCamelCaseLetters(
        'fbide',
        'FaceBookIntegratedDevelopmentEnvironment',
      ),
    ).toBe(true);
    expect(checkIfMatchesCamelCaseLetters('fb', 'FooBar.js')).toBe(true);
    expect(checkIfMatchesCamelCaseLetters('fb', 'FooBarBaz.js')).toBe(false);
  });

  it('is indifferent about the case of only the first characted in `haystack`', () => {
    expect(checkIfMatchesCamelCaseLetters('fbide', 'fBIDE')).toBe(true);
    expect(checkIfMatchesCamelCaseLetters('fbide', 'fbIDE')).toBe(false);
  });
});

describe('scoreCommonSubsequence', () => {
  it('returns -1 if there is no common subsequence', () => {
    expect(scoreCommonSubsequence('nuclide', 'noclide')).toEqual(-1);
    expect(scoreCommonSubsequence('nuclide', 'nucl')).toEqual(-1);
    expect(scoreCommonSubsequence('nuclide', '')).toEqual(-1);
  });

  it('returns a score of 0 for exact matches', () => {
    expect(scoreCommonSubsequence('nuclide', 'nuclide')).toEqual(0);
  });

  it('ignores the case of characters in `needle`, but not vice-versa', () => {
    expect(scoreCommonSubsequence('nuclide', 'NuclIDE')).toEqual(0);
    expect(scoreCommonSubsequence('NuclIDE', 'nuclide')).toEqual(-1);
  });

  it('ignores non-alphanumeric characters in `haystack`', () => {
    expect(scoreCommonSubsequence('nuclide', 'n u c l i d e')).toEqual(0);
    expect(scoreCommonSubsequence('nuclide', 'n_u-c.l?i!d@e')).toEqual(0);
  });

  it('returns the correct relevance score for a given needle in a simple haystack', () => {
    expect(scoreCommonSubsequence('nuclid', 'nuclide')).toEqual(13);
    expect(scoreCommonSubsequence('nucli', 'nuclide')).toEqual(12);
    expect(scoreCommonSubsequence('nucl', 'nuclide')).toEqual(11);
    expect(scoreCommonSubsequence('nuc', 'nuclide')).toEqual(10);
    expect(scoreCommonSubsequence('nu', 'nuclide')).toEqual(9);
    expect(scoreCommonSubsequence('n', 'nuclide')).toEqual(8);
    expect(scoreCommonSubsequence('', 'nuclide')).toEqual(7);
  });

  it('returns the correct relevance score for a given needle in a complex haystack', () => {
    expect(scoreCommonSubsequence('needle', 'needles')).toEqual(13);
    expect(scoreCommonSubsequence('needle', 'aneedle')).toEqual(34);
    expect(scoreCommonSubsequence('needle', 'aBunchOfNeedles')).toEqual(81);
    // TODO this shows that clustering can be improved, as the following scores should be identical:
    expect(scoreCommonSubsequence('needle', 'twoneedle')).toEqual(42);
    expect(scoreCommonSubsequence('needle', 'oneneedle')).toEqual(78);
  });
});

describe('isLetterImportant', () => {
  it('considers the first two letters important', () => {
    expect(isLetterImportant(0, 'foobar')).toBe(true);
    expect(isLetterImportant(1, 'foobar')).toBe(true);
    expect(isLetterImportant(2, 'foobar')).toBe(false);
  });

  it('considers capital letters important', () => {
    expect(isLetterImportant(3, 'fooBarBaz')).toBe(true);
    expect(isLetterImportant(4, 'fooBarBaz')).toBe(false);
    expect(isLetterImportant(5, 'fooBarBaz')).toBe(false);
    expect(isLetterImportant(6, 'fooBarBaz')).toBe(true);
    expect(isLetterImportant(7, 'fooBarBaz')).toBe(false);
  });

  it('considers letters following delimiting characters important', () => {
    expect(isLetterImportant(2, 'iam_a-delimited.file')).toBe(false);
    expect(isLetterImportant(3, 'iam_a-delimited.file')).toBe(false);
    expect(isLetterImportant(4, 'iam_a-delimited.file')).toBe(true);
    expect(isLetterImportant(5, 'iam_a-delimited.file')).toBe(false);
    expect(isLetterImportant(6, 'iam_a-delimited.file')).toBe(true);
    expect(isLetterImportant(16, 'iam_a-delimited.file')).toBe(true);
  });
});

import {areSetsEqual} from 'nuclide-commons/collection';

describe('importantCharactersForString', () => {
  it('returns the set of important characters for a given string', () => {
    expect(
      areSetsEqual(importantCharactersForString('foobar'), new Set(['f', 'o'])),
    ).toBe(true);

    expect(
      areSetsEqual(
        importantCharactersForString('fooBar'),
        new Set(['f', 'o', 'B']),
      ),
    ).toBe(true);

    expect(
      areSetsEqual(
        importantCharactersForString('foo.bar'),
        new Set(['f', 'o', 'b']),
      ),
    ).toBe(true);

    expect(
      areSetsEqual(importantCharactersForString('foobar'), new Set(['f', 'o'])),
    ).toBe(true);
  });
});
