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

import {Range} from 'atom';
import {wordAtPositionFromBuffer} from 'nuclide-commons/range';

export function wordAtPosition(
  editor: atom$TextEditor,
  position: atom$PointObject,
  wordRegex_: ?RegExp,
): ?{wordMatch: Array<string>, range: atom$Range} {
  let wordRegex = wordRegex_;
  if (!wordRegex) {
    wordRegex = editor.getLastCursor().wordRegExp();
  }
  const buffer = editor.getBuffer();
  return wordAtPositionFromBuffer(buffer, position, wordRegex);
}

/**
 * Gets the trimmed range from a given range, i.e. moves the start and end points
 * to the first and last non-whitespace characters (or specified regex)
 * within the range respectively.
 *
 * @param editor       the editor containing the range
 * @param rangeToTrim  the range to trim
 * @param stopRegex    stop trimming when the first match is found for this regex,
 *   defaults to first non-whitespace character
 * @return atom$Range  the trimmed range
 */
export function trimRange(
  editor: atom$TextEditor,
  rangeToTrim: atom$Range,
  stopRegex: RegExp = /\S/,
): atom$Range {
  const buffer = editor.getBuffer();
  let {start, end} = rangeToTrim;
  buffer.scanInRange(stopRegex, rangeToTrim, ({range, stop}) => {
    start = range.start;
    stop();
  });
  buffer.backwardsScanInRange(stopRegex, rangeToTrim, ({range, stop}) => {
    end = range.end;
    stop();
  });
  return new Range(start, end);
}
