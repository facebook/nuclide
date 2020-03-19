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
import {computeDiff, computeConsolidatedDiff} from '../computeDiff';

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
      expect(newToOld).toEqual([0, 1, 1, 2]);
      expect(oldToNew).toEqual([0, 2, 3]);
    });
  });

  describe('computeConsolidatedDiff()', () => {
    it('diffs two empty texts', () => {
      const options = {
        includeOldText: true,
        ignoreWhitespace: false,
        includeHunks: true,
        includeNewText: false,
      };
      const {textDiff, oldFile, hunks} = computeConsolidatedDiff(
        '',
        '',
        options,
      );
      expect(textDiff.addedLines).toEqual([]);
      expect(textDiff.removedLines).toEqual([]);
      expect(textDiff.oldLineOffsets.length).toBe(0);
      expect(textDiff.newLineOffsets.length).toBe(0);
      expect(textDiff.newToOld).toEqual([0, 1, 2]);
      expect(textDiff.oldToNew).toEqual([0, 1, 2]);
      expect(oldFile).toEqual('');
      expect(hunks.length).toBe(0);
    });

    it('diffs simple text deletion and addition', () => {
      const options = {
        includeOldText: false,
        ignoreWhitespace: false,
        includeHunks: true,
        includeNewText: false,
      };

      const {textDiff, hunks} = computeConsolidatedDiff(
        `simple text
on multiline
same end line`,
        `on multiline
added text
same end line`,
        options,
      );

      expect(textDiff.addedLines).toEqual([1]); // the second line is newly added.
      expect(textDiff.removedLines).toEqual([0]); // the first line was removed.
      expect(textDiff.oldLineOffsets).toEqual([[2, 1]]); // offset 1 for the new added line.
      expect(textDiff.newLineOffsets).toEqual([[0, 1]]); // offset 1 for the first removed line.
      expect(textDiff.newToOld).toEqual([1, 2, 2, 3, 4]);
      expect(textDiff.oldToNew).toEqual([0, 0, 2, 3, 4]);
      expect(hunks.length).toBe(2);
      expect(hunks[0]).toEqual({
        added: 0,
        removed: 1,
        oldText: 'simple text\n',
        newStart: 0,
      });
      expect(hunks[1]).toEqual({
        added: 1,
        removed: 0,
        oldText: '',
        newStart: 2,
      });
    });

    it('diffs multi-line text changes', () => {
      const options = {
        includeOldText: false,
        ignoreWhitespace: false,
        includeHunks: true,
        includeNewText: false,
      };

      const {textDiff, hunks} = computeConsolidatedDiff(
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
        options,
      );

      expect(textDiff.addedLines).toEqual([2, 3, 7]); // 2 lines were added in the middle and one at the end.
      // 2 lines were removed in the middle and last new-line replaced.
      expect(textDiff.removedLines).toEqual([1, 2, 7]);
      expect(textDiff.oldLineOffsets).toEqual([[4, 2]]); // offset 2 for the 2 lines added.
      expect(textDiff.newLineOffsets).toEqual([[1, 2]]); // offset 2 for the 2 lines removed.
      expect(textDiff.newToOld).toEqual([0, 3, 4, 4, 4, 5, 6, 7, 8]);
      expect(textDiff.oldToNew).toEqual([0, 1, 1, 1, 4, 5, 6, 7, 8]);
      expect(hunks.length).toBe(3);
      expect(hunks[0]).toEqual({
        added: 0,
        removed: 2,
        oldText: 'If we test at too low a level,\ntesting for matching tags\n',
        newStart: 1,
      });
      expect(hunks[1]).toEqual({
        added: 2,
        removed: 0,
        oldText: '',
        newStart: 3,
      });
      expect(hunks[2]).toEqual({
        added: 1,
        removed: 1,
        oldText: '\n',
        newStart: 8,
      });
    });

    it('diffs modification where removed lines are smaller than added lines', () => {
      const options = {
        includeOldText: false,
        ignoreWhitespace: false,
        includeHunks: true,
        includeNewText: false,
      };

      const {hunks} = computeConsolidatedDiff(
        'unchanged\nremoved\nremoved\nunchanged\n',
        'unchanged\nadded\nadded\nadded\nunchanged\n',
        options,
      );

      expect(hunks.length).toBe(1);
      expect(hunks[0]).toEqual({
        added: 3,
        removed: 2,
        oldText: 'removed\nremoved\n',
        newStart: 2,
      });
    });

    it('diffs modification where added lines are smaller than removed lines', () => {
      const options = {
        includeOldText: false,
        ignoreWhitespace: false,
        includeHunks: true,
        includeNewText: false,
      };

      const {hunks} = computeConsolidatedDiff(
        'unchanged\nremoved\nremoved\nunchanged\n',
        'unchanged\nadded\nunchanged\n',
        options,
      );

      expect(hunks.length).toBe(1);
      expect(hunks[0]).toEqual({
        added: 1,
        removed: 2,
        oldText: 'removed\nremoved\n',
        newStart: 2,
      });
    });
  });
});
