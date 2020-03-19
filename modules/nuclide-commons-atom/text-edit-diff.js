/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */
import type {TextEdit} from './text-edit';

import invariant from 'assert';
import {Range} from 'atom';

type Hunk = {
  rows: Array<number>,
  newLines: Array<string>,
};

export function toUnifiedDiff(
  filename: string,
  buffer: atom$TextBuffer,
  edits: Array<TextEdit>,
  contextRows: number = 1,
): string {
  const hunks: Array<Hunk> = getHunks(buffer, edits, contextRows);
  return [`--- ${filename}`, `+++ ${filename}`]
    .concat(mapHunkToString(buffer, hunks, contextRows))
    .join('\n');
}

function getHunks(
  buffer: atom$TextBuffer,
  edits: Array<TextEdit>,
  contextRows: number,
): Array<Hunk> {
  return edits
    .sort((e1, e2) => e1.oldRange.compare(e2.oldRange))
    .reduce((mergedEdits: Array<TextEdit>, nextEdit: TextEdit) => {
      const edit = mergedEdits[mergedEdits.length - 1];
      if (
        edit &&
        nextEdit.oldRange.start.row <= edit.oldRange.end.row + contextRows
      ) {
        mergedEdits[mergedEdits.length - 1] = mergeEdit(buffer, edit, nextEdit);
      } else {
        mergedEdits.push(nextEdit);
      }
      return mergedEdits;
    }, [])
    .map((edit: TextEdit) => {
      const oldRange = edit.oldRange;
      const rows = oldRange.getRows();
      const newText =
        buffer.lineForRow(rows[0]).substring(0, oldRange.start.column) +
        edit.newText +
        buffer.lineForRow(rows[rows.length - 1]).substring(oldRange.end.column);
      const newLines = newText.split(/\r\n|\r|\n/);
      return {rows, newLines};
    });
}

function mergeEdit(
  buffer: atom$TextBuffer,
  e1: TextEdit,
  e2: TextEdit,
): TextEdit {
  invariant(e1.oldRange.end.isLessThanOrEqual(e2.oldRange.start));
  const mergedEdit = {};
  mergedEdit.newText =
    e1.newText +
    buffer.getTextInRange(new Range(e1.oldRange.end, e2.oldRange.start)) +
    e2.newText;
  mergedEdit.oldRange = e1.oldRange.union(e2.oldRange);
  return mergedEdit;
}

function mapHunkToString(
  buffer: atom$TextBuffer,
  hunks: Array<Hunk>,
  contextRows: number,
): Array<string> {
  // This requires storing some state across the map() to compute the row
  // numbers correctly.
  let newRowOffset = 0;
  return hunks.map((hunk: Hunk) => {
    const {rows, newLines} = hunk;
    const beforeRows = [];
    const afterRows = [];
    for (let i = 1; i <= contextRows; i++) {
      const beforeRow = rows[0] - i;
      const afterRow = rows[rows.length - 1] + i;
      if (beforeRow >= 0) {
        beforeRows.unshift(beforeRow);
      }
      if (afterRow <= buffer.getLastRow()) {
        afterRows.push(afterRow);
      }
    }
    const oldBeginRow = rows[0] - beforeRows.length + 1;
    const oldRowLength = rows.length + beforeRows.length + afterRows.length;
    const newBeginRow = oldBeginRow + newRowOffset;
    const newRowLength = newLines.length + beforeRows.length + afterRows.length;

    const parts = [];
    parts.push(
      `@@ -${oldBeginRow},${oldRowLength} +${newBeginRow},${newRowLength} @@`,
    );
    beforeRows.forEach(row => {
      parts.push(' ' + buffer.lineForRow(row));
    });
    rows.forEach(row => {
      parts.push('-' + buffer.lineForRow(row));
    });
    newLines.forEach(line => {
      parts.push('+' + line);
    });
    afterRows.forEach(row => {
      parts.push(' ' + buffer.lineForRow(row));
    });
    newRowOffset += newLines.length - rows.length;
    return parts.join('\n');
  });
}
