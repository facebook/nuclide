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

import {diffLines} from 'diff';

export type LineMapper = Array<number>;

export type LineMapping = {
  newToOld: LineMapper,
  oldToNew: LineMapper,
};

export type ConsolidatedDiff = {
  textDiff: TextDiff,
  oldFile: ?string,
  newFile: ?string,
  hunks: Array<ConsolidatedDiffHunk>,
};

export type DiffOptions = {
  includeOldText: boolean,
  includeNewText: boolean,
  ignoreWhitespace: boolean,
  includeHunks: boolean,
};

export type TextDiff = LineMapping & {
  addedLines: Array<number>,
  removedLines: Array<number>,
  oldLineOffsets: Array<[number, number]>,
  newLineOffsets: Array<[number, number]>,
};

export type ConsolidatedDiffHunk = {
  added: number,
  removed: number,
  oldText: string,
  newStart: number,
};

type ChunkPiece = {
  added: number,
  removed: number,
  value: string,
  count: number,
  offset: number,
};

type DiffChunk = {
  addedLines: Array<number>,
  removedLines: Array<number>,
  chunks: Array<ChunkPiece>,
  consolidatedHunks: Array<ConsolidatedDiffHunk>,
};

export type OffsetMap = Map<number, number>;

export function computeDiff(
  oldText: string,
  newText: string,
  ignoreWhitespace?: boolean = false,
): TextDiff {
  const {addedLines, removedLines, chunks} = _computeDiffChunks(
    oldText,
    newText,
    ignoreWhitespace,
  );
  const {oldLineOffsets, newLineOffsets} = _computeOffsets(chunks);
  const {oldToNew, newToOld} = _computeLineDiffMapping(chunks);

  return {
    addedLines,
    removedLines,
    oldLineOffsets: Array.from(oldLineOffsets), // serialize for JSON.
    newLineOffsets: Array.from(newLineOffsets), // serialize for JSON.
    oldToNew,
    newToOld,
  };
}

export function computeConsolidatedDiff(
  oldText: string,
  newText: string,
  options: DiffOptions,
): ConsolidatedDiff {
  const {
    addedLines,
    removedLines,
    chunks,
    consolidatedHunks,
  } = _computeDiffChunks(oldText, newText, options.ignoreWhitespace);
  const {oldLineOffsets, newLineOffsets} = _computeOffsets(chunks);
  const {oldToNew, newToOld} = _computeLineDiffMapping(chunks);

  const returnValue: ConsolidatedDiff = {
    textDiff: {
      addedLines,
      removedLines,
      oldLineOffsets: Array.from(oldLineOffsets), // serialize for JSON.
      newLineOffsets: Array.from(newLineOffsets), // serialize for JSON.
      oldToNew,
      newToOld,
    },
    hunks: [],
    oldFile: null,
    newFile: null,
  };

  if (options.includeOldText) {
    returnValue.oldFile = oldText;
  }
  if (options.includeNewText) {
    returnValue.newFile = newText;
  }
  if (options.includeHunks) {
    returnValue.hunks = consolidatedHunks;
  }
  return returnValue;
}

function _computeDiffChunks(
  oldText_: string,
  newText_: string,
  ignoreWhitespace: boolean,
): DiffChunk {
  let oldText = oldText_;
  let newText = newText_;

  // If the last line has changes, JsDiff doesn't return that.
  // Generally, content with new line ending are easier to calculate offsets for.
  if (
    oldText[oldText.length - 1] !== '\n' ||
    newText[newText.length - 1] !== '\n'
  ) {
    oldText += '\n';
    newText += '\n';
  }

  const lineDiff = diffLines(oldText, newText, {
    ignoreWhitespace,
  });
  const chunks = [];
  const consolidatedHunks = [];

  let addedCount = 0;
  let removedCount = 0;
  let nextOffset = 0;
  let offset = 0;
  let lineCount = 1;
  let startNewHunk = true;

  const addedLines = [];
  const removedLines = [];
  lineDiff.forEach(part => {
    const {added, removed, value} = part;
    const count = value.split('\n').length - 1;
    if (!added && !removed) {
      addedCount += count;
      removedCount += count;
      offset = nextOffset;
      nextOffset = 0;
      lineCount += count;
      startNewHunk = true;
    } else if (added) {
      if (startNewHunk) {
        consolidatedHunks.push({
          added: count,
          removed: 0,
          oldText: '',
          newStart: lineCount,
        });
      } else {
        const hunkToEdit = consolidatedHunks[consolidatedHunks.length - 1];
        hunkToEdit.added = count;
        hunkToEdit.newStart = lineCount;
      }
      for (let i = 0; i < count; i++) {
        addedLines.push(addedCount + i);
      }
      addedCount += count;
      nextOffset += count;
      startNewHunk = true;
      lineCount += count;
    } else {
      consolidatedHunks.push({
        added: 0,
        removed: count,
        oldText: value,
        newStart: lineCount - 1,
      });
      for (let i = 0; i < count; i++) {
        removedLines.push(removedCount + i);
      }
      removedCount += count;
      nextOffset -= count;
      startNewHunk = false;
    }
    chunks.push({added, removed, value, count, offset});
    offset = 0;
  });

  if (nextOffset !== 0) {
    // Add a trailing offset block at the end of the shorter file.
    chunks.push({
      added: 0,
      removed: 0,
      value: '',
      count: 0,
      offset: nextOffset,
    });
  }
  return {addedLines, removedLines, chunks, consolidatedHunks};
}

function _computeOffsets(
  diffChunks: Array<ChunkPiece>,
): {oldLineOffsets: OffsetMap, newLineOffsets: OffsetMap} {
  const newLineOffsets = new Map();
  const oldLineOffsets = new Map();

  let oldLineCount = 0;
  let newLineCount = 0;

  for (const chunk of diffChunks) {
    const {added, removed, offset, count} = chunk;
    if (added) {
      newLineCount += count;
    } else if (removed) {
      oldLineCount += count;
    } else {
      if (offset < 0) {
        // Non zero offset implies this block is neither a removal or an addition,
        // and is thus equal in both versions of the document.
        // Sign of offset indicates which version of document requires the offset
        // (negative -> old version, positive -> new version).
        // Magnitude of offset indicates the number of offset lines required for version.
        newLineOffsets.set(newLineCount, offset * -1);
      } else if (offset > 0) {
        oldLineOffsets.set(oldLineCount, offset);
      }
      newLineCount += count;
      oldLineCount += count;
    }
  }

  return {
    oldLineOffsets,
    newLineOffsets,
  };
}

function _computeLineDiffMapping(diffChunks: Array<ChunkPiece>): LineMapping {
  const newToOld = [];
  const oldToNew = [];

  let oldLineCount = 0;
  let newLineCount = 0;

  // Used to track the changed sections.
  let addedCount = 0;
  let removedCount = 0;

  for (const chunk of diffChunks) {
    const {added, removed, offset, count} = chunk;
    if (added) {
      addedCount = count;
    } else if (removed) {
      removedCount = count;
    } else {
      if (addedCount > 0 && removedCount > 0) {
        // There's a changed section.
        const changedCount = Math.min(addedCount, removedCount);
        for (let i = 0; i < changedCount; i++) {
          oldToNew.push(newLineCount + i);
          newToOld.push(oldLineCount + i);
        }
      }
      newLineCount += addedCount;
      oldLineCount += removedCount;
      if (offset < 0) {
        for (let i = offset; i < 0; i++) {
          oldToNew.push(newLineCount);
        }
      } else if (offset > 0) {
        for (let i = 0; i < offset; i++) {
          newToOld.push(oldLineCount);
        }
      }
      for (let i = 0; i < count; i++) {
        newToOld.push(oldLineCount);
        oldToNew.push(newLineCount);
        newLineCount++;
        oldLineCount++;
      }
      addedCount = 0;
      removedCount = 0;
    }
  }

  // Add two line number mapping for `after` decorations.
  newToOld.push(oldLineCount++);
  newToOld.push(oldLineCount);

  oldToNew.push(newLineCount++);
  oldToNew.push(newLineCount);

  return {
    newToOld,
    oldToNew,
  };
}
