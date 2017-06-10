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

import chalk from 'chalk';
import invariant from 'assert';
import {addMatchers, diffJson, diffLines} from '../lib/matchers';

describe('matchers', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  describe('matchers.diffJson', () => {
    it('accepts two identical objects.', () => {
      const actual = {a: 2, b: {c: 3}};
      const expected = {b: {c: 3}, a: 2};
      expect(actual).diffJson(expected);
    });

    it('rejects two different objects.', () => {
      const actual = {a: 1, b: 2};
      const expected = {b: 2, c: 3};
      expect(actual).not.diffJson(expected);
    });

    it('colors diff output.', () => {
      const match = {actual: {a: 1, b: 2}};
      const isMatch = diffJson.bind(match)({b: 2, c: 3});

      const expected =
        chalk.gray('{\n') +
        chalk.green('  "a": 1,\n') +
        chalk.gray('  "b": 2,\n') +
        chalk.red('  "c": 3\n') +
        chalk.gray('}');

      expect(isMatch).toBe(false);
      invariant(typeof match.message === 'function');
      expect(match.message()).toEqual(expected);
    });
  });

  describe('matchers.diffLines', () => {
    it('accepts two identical strings.', () => {
      const actual = 'line1\nline2\nline3';
      const expected = 'line1\nline2\nline3';
      expect(actual).diffLines(expected);
    });

    it('rejects two different strings.', () => {
      const actual = 'line1\nline2\nline3';
      const expected = 'line1\nline3';
      expect(actual).not.diffLines(expected);
    });

    it('colors diff output.', () => {
      const match = {actual: 'line1\nline2\nline3'};
      const isMatch = diffLines.bind(match)('line1\nline3');

      const expected =
        chalk.gray('line1\n') + chalk.green('line2\n') + chalk.gray('line3');

      expect(isMatch).toBe(false);
      invariant(typeof match.message === 'function');
      expect(match.message()).toEqual(expected);
    });
  });
});
