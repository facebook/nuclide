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

import {computeDiff} from '../computeDiff';

describe('diff-utils', () => {
  describe('computeDiff()', () => {
    it('diffs two empty texts', () => {
      const {
        addedLines,
        removedLines,
        oldLineOffsets,
        newLineOffsets,
        newToOld,
        oldToNew,
      } = computeDiff('', '');
      expect(addedLines).toEqual([]);
      expect(removedLines).toEqual([]);
      expect(oldLineOffsets.length).toBe(0);
      expect(newLineOffsets.length).toBe(0);
      expect(newToOld).toEqual([0, 1, 2]);
      expect(oldToNew).toEqual([0, 1, 2]);
    });

    it('diffs simple text with one line changes', () => {
      const {
        addedLines,
        removedLines,
        oldLineOffsets,
        newLineOffsets,
        newToOld,
        oldToNew,
      } = computeDiff(
        `simple text
on multiline
same end line`,
        `on multiline
added text
same end line`,
      );

      expect(addedLines).toEqual([1]); // the second line is newly added.
      expect(removedLines).toEqual([0]); // the first line was removed.
      expect(oldLineOffsets).toEqual([[2, 1]]); // offset 1 for the new added line.
      expect(newLineOffsets).toEqual([[0, 1]]); // offset 1 for the first removed line.
      expect(newToOld).toEqual([1, 2, 2, 3, 4]);
      expect(oldToNew).toEqual([0, 0, 2, 3, 4]);
    });

    it('diffs multi-line text changes', () => {
      const {
        addedLines,
        removedLines,
        oldLineOffsets,
        newLineOffsets,
        newToOld,
        oldToNew,
      } = computeDiff(
        `This text is intended for testing.
If we test at too low a level,
testing for matching tags
with pattern matching,
our tests will be BAD.
The slightest change in layout,
could break a large number of tests.
`,
        `This text is intended for testing.
with pattern matching,
adding different two lines
replacing the two lines removed above!
our tests will be BAD.
The slightest change in layout,
could break a large number of tests.
adding a non-new-line line`,
      );

      expect(addedLines).toEqual([2, 3, 7]); // 2 lines were added in the middle and one at the end.
      // 2 lines were removed in the middle and last new-line replaced.
      expect(removedLines).toEqual([1, 2, 7]);
      expect(oldLineOffsets).toEqual([[4, 2]]); // offset 2 for the 2 lines added.
      expect(newLineOffsets).toEqual([[1, 2]]); // offset 2 for the 2 lines removed.
      expect(newToOld).toEqual([0, 3, 4, 4, 4, 5, 6, 7, 8]);
      expect(oldToNew).toEqual([0, 1, 1, 1, 4, 5, 6, 7, 8]);
    });

    it('diffs new text longer than the other', () => {
      const {
        addedLines,
        removedLines,
        oldLineOffsets,
        newLineOffsets,
        newToOld,
        oldToNew,
      } = computeDiff(
        'first line text\n',
        'first line text\nsecond line text\n',
      );
      expect(addedLines).toEqual([1]);
      expect(removedLines).toEqual([]);
      expect(oldLineOffsets).toEqual([[1, 1]]); // offset for the last added line.
      expect(newLineOffsets.length).toBe(0);
      expect(newToOld).toEqual([0, 1, 2, 3]);
      expect(oldToNew).toEqual([0, 1, 2]);
    });
  });
});
