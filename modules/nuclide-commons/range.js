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

export function wordAtPositionFromBuffer(
  buffer: atom$TextBuffer | simpleTextBuffer$TextBuffer,
  position: atom$PointObject,
  wordRegex: RegExp,
): ?{wordMatch: Array<string>, range: atom$Range} {
  const {row, column} = position;
  const rowRange = buffer.rangeForRow(row);
  let matchData;
  // Extract the expression from the row text.
  buffer.scanInRange(wordRegex, rowRange, data => {
    const {range} = data;
    if (
      range.start.isLessThanOrEqual(position) &&
      range.end.isGreaterThan(position)
    ) {
      matchData = data;
    }
    // Stop the scan if the scanner has passed our position.
    if (range.end.column > column) {
      data.stop();
    }
  });
  if (matchData) {
    return {
      wordMatch: matchData.match,
      range: matchData.range,
    };
  } else {
    return null;
  }
}

// Matches a regex on the text of the line ending at endPosition.
// regex should end with a '$'.
// Useful for autocomplete.
export function matchRegexEndingAt(
  buffer: atom$TextBuffer | simpleTextBuffer$TextBuffer,
  endPosition: atom$PointObject,
  regex: RegExp,
): ?string {
  const line = buffer.getTextInRange([[endPosition.row, 0], endPosition]);
  const match = regex.exec(line);
  return match == null ? null : match[0];
}

export function isPositionInRange(
  position: atom$Point,
  range: atom$Range | Array<atom$Range>,
): boolean {
  return Array.isArray(range)
    ? range.some(r => r.containsPoint(position))
    : range.containsPoint(position);
}
