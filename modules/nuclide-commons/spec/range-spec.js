/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import invariant from 'assert';
import {default as TextBuffer, Range} from 'simple-text-buffer';
import {wordAtPositionFromBuffer} from '../range';

describe('wordAtPositionFromBuffer', () => {
  it('matches a word in a buffer', () => {
    const buffer = new TextBuffer('word1 word2 word3\n');
    const match = wordAtPositionFromBuffer(buffer, {row: 0, column: 6}, /\S+/g);
    expect(match).not.toBeNull();
    invariant(match != null);
    expect(match.wordMatch.length).toBe(1);
    expect(match.wordMatch[0]).toBe('word2');
    expect(match.range).toEqual(new Range([0, 6], [0, 11]));
  });

  it('should not include endpoints', () => {
    const buffer = new TextBuffer('word1 word2 word3\n');
    const match = wordAtPositionFromBuffer(buffer, {row: 0, column: 5}, /\S+/g);
    expect(match).toBeNull();
  });
});
