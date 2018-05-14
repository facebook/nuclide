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

/*
 * This file contains a set of custom matchers for jasmine testing, which can be used
 * to get more detailed / useful diffs on various results. These can be used in a test by doing:
 *
 * import {addMatchers} from 'nuclide-test-helpers';
 *
 * And then in a `beforeEach()`:
 *
 * ```
 * beforeEach(() => {
 *   addMatchers(this);
 * }
 * ```
 */

// We have to create an invariant function that is a lie because using invariant() with an
// instanceof check is the only way to convince Flow of the type of an unbound `this`.
const invariant = (condition: boolean) => {};

import chalk from 'chalk';
import * as diff from 'diff';

type Change = {
  value: string,
  removed?: boolean,
  added?: boolean,
};

/**
 * Do a recursive diff of two JSON objects. This function should not be called
 * directly, but rather added as a Jasmine custom matcher.
 * @param The expected result from the test.
 * @this A JasmineMatcher object.
 * @returns True if the objects are identical.
 */
export function diffJson(expected: Object): boolean {
  const parts = diff.diffJson(expected, this.actual);
  const {message, changes} = formatMessage(parts);
  invariant(this instanceof jasmine.Matchers);
  this.message = () => message;
  return changes === 0;
}

/**
 * Do a line by line diff of two strings. This function should not be called
 * directly, but rather added as a Jasmine custom matcher.
 * @param The expected result from the test.
 * @this A JasmineMatcher object.
 * @returns True if the strings are identical.
 */
export function diffLines(expected: string): boolean {
  const parts = diff.diffLines(expected, this.actual);
  const {message, changes} = formatMessage(parts);
  invariant(this instanceof jasmine.Matchers);
  this.message = () => message;
  return changes === 0;
}

/**
 * Helper function that counts changes in the output from JsDiff, as well as
 * generates a colored message that shows diff output.
 * @param The output from JsDiff.
 * @returns On object containing the number of changes (added or removed parts),
 *   and a string containing the colored diff output.
 */
function formatMessage(
  parts: Array<Change>,
): {changes: number, message: string} {
  let changes = 0;
  let message = '';
  for (const part of parts) {
    let color = 'gray';
    if (part.added || part.removed) {
      ++changes;
      color = part.added ? 'green' : 'red';
    }
    message += chalk[color](part.value);
  }
  return {changes, message};
}

export function addMatchers(spec: JasmineSpec) {
  const matchersPrototype = {
    diffJson,
    diffLines,
  };
  spec.addMatchers(matchersPrototype);
}
