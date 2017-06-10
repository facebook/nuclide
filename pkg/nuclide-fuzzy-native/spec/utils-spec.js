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

import {scoreComparator, valueComparator} from '../lib/utils';

describe('utils', () => {
  describe('scoreComparator', () => {
    it('returns >1 when the first score is greater', () => {
      expect(
        scoreComparator({score: 2, value: ''}, {score: 1, value: ''}),
      ).toBeGreaterThan(0);
      expect(
        scoreComparator({score: 2, value: 'A'}, {score: 2, value: 'a'}),
      ).toBeGreaterThan(0);
    });

    it('returns <1 when the second score is greater', () => {
      expect(
        scoreComparator({score: 1, value: ''}, {score: 2, value: ''}),
      ).toBeLessThan(0);
      expect(
        scoreComparator({score: 2, value: 'a'}, {score: 2, value: 'A'}),
      ).toBeLessThan(0);
    });

    it('returns 0 when the scores are equal', () => {
      expect(
        scoreComparator({score: 1, value: ''}, {score: 1, value: ''}),
      ).toBe(0);
      expect(
        scoreComparator({score: 2, value: 'A'}, {score: 2, value: 'A'}),
      ).toBe(0);
    });
  });

  describe('valueComparator', () => {
    it('alpha-sorts and breaks ties with capital letters first', () => {
      expect(valueComparator('A', 'A')).toBe(0);
      expect(valueComparator('a', 'a')).toBe(0);
      expect(valueComparator('A', 'a')).toBeLessThan(0);
      expect(valueComparator('a', 'A')).toBeGreaterThan(0);
    });

    it('shorter string sorts first', () => {
      expect(valueComparator('Bb', 'Bba')).toBeLessThan(0);
      expect(valueComparator('Bba', 'Bb')).toBeGreaterThan(0);
    });

    it('tiebreaker applied only for first non-matching character', () => {
      expect(valueComparator('CAT', 'CaT')).toBeLessThan(0);
      expect(valueComparator('CaT', 'CAT')).toBeGreaterThan(0);
    });

    it('behaves like localeCompare', () => {
      expect(valueComparator('apple', 'CAT')).toBeLessThan(0);
      expect(valueComparator('CAT', 'Cat')).toBeLessThan(0);
    });
  });
});
