/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

/**
 * Matches a hunk summary line as specified in the unified diff format.
 * Explained here: http://www.gnu.org/software/diffutils/manual/html_node/Detailed-Unified.html
 * and here: http://www.artima.com/weblogs/viewpost.jsp?thread=164293.
 */
const HUNK_REGEX = /@@ .* @@((.|\n)(?!^@@))*/gm;
const HUNK_DIFF_REGEX = /@@ .* @@/;
const HUNK_OLD_INFO_REGEX = /-([0-9]+)((?:,[0-9]+)?)/;
const HUNK_NEW_INFO_REGEX = /\+([0-9]+)((?:,[0-9]+)?)/;

import {lastFromArray} from 'nuclide-commons/collection';
import os from 'os';
import type {DiffInfo} from './types';

/**
 * Parses the output of `hg diff --unified 0`.
 */
export function parseHgDiffUnifiedOutput(output: string): DiffInfo {
  const diffInfo: DiffInfo = {
    added: 0,
    deleted: 0,
    lineDiffs: [],
  };
  if (!output) {
    return diffInfo;
  }
  const diffHunks = output.match(HUNK_REGEX);
  if (diffHunks == null) {
    return diffInfo;
  }
  // $FlowFixMe regex iterable not recognized
  diffHunks.forEach(hunk => {
    // `hunk` will look like: "@@ -a(,b) +c(,d) @@"
    const hunkParts = hunk.match(HUNK_DIFF_REGEX)[0].split(' ');
    const oldInfo = hunkParts[1].match(HUNK_OLD_INFO_REGEX);
    const newInfo = hunkParts[2].match(HUNK_NEW_INFO_REGEX);

    // `oldInfo`/`newInfo` will look like: ["a,b", "a", ",b"], or ["a", "a", ""].
    // $FlowFixMe may be null
    const oldStart = parseInt(oldInfo[1], 10);
    // $FlowFixMe may be null
    const newStart = parseInt(newInfo[1], 10);
    // According to the spec, if the line length is 1, it may be omitted.
    // $FlowFixMe may be null
    const oldLines = oldInfo[2] ? parseInt(oldInfo[2].substring(1), 10) : 1;
    // $FlowFixMe may be null
    const newLines = newInfo[2] ? parseInt(newInfo[2].substring(1), 10) : 1;
    // Parse removed lines from the diff hunk.
    const oldText = hunk
      .split('\n')
      // Remove the header for the hunk, as well as lines added
      .slice(1, oldLines + 1)
      // Remove the leading '-' character, then append the newline that was stripped
      .map(line => line.trimLeft().substring(1) + '\n')
      // Rejoin the lines into a single string
      .join('');

    diffInfo.added += newLines;
    diffInfo.deleted += oldLines;
    diffInfo.lineDiffs.push({oldStart, oldLines, newStart, newLines, oldText});
  });

  return diffInfo;
}

const SINGLE_UNIFIED_DIFF_BEGINNING_REGEX = /--- /;
const SINGLE_UNIFIED_DIFF_SECOND_LINE_REGEX = /\+\+\+ /;
const DEV_NULL_FILE_PATH = '/dev/null';

/**
 * Parses the output of `hg diff --unified 0 --noprefix` from one or more files.
 * @return A map of each file path in the output (relative to the root of the
 *   repo) to its parsed DiffInfo.
 */
export function parseMultiFileHgDiffUnifiedOutput(
  output: string,
): Map<string, DiffInfo> {
  const filePathToDiffInfo = new Map();
  // Split the output by the symbols '--- '. This is specified in the Unified diff format:
  // http://www.gnu.org/software/diffutils/manual/html_node/Detailed-Unified.html#Detailed-Unified.
  let diffOutputs = output.split(SINGLE_UNIFIED_DIFF_BEGINNING_REGEX);
  // Throw out the first chunk (anything before the first '--- ' sequence), because
  // it is not part of a complete diff.
  diffOutputs = diffOutputs.slice(1);
  for (const diffOutputForFile of diffOutputs) {
    // First, extract the file name. The first line of the string should be the
    // old file path, except if the file was newly added.
    const newLineChar = os.EOL;
    const firstNewline = diffOutputForFile.indexOf(newLineChar);
    const oldFilePath = diffOutputForFile.slice(0, firstNewline).trim();

    // line immediately following starts with "+++ ", containing the new
    // file path.
    const secondLineStart = firstNewline + newLineChar.length;
    const secondNewLine = diffOutputForFile.indexOf(
      newLineChar,
      secondLineStart,
    );
    const secondLine = diffOutputForFile.slice(secondLineStart, secondNewLine);
    const newFilePath = lastFromArray(
      secondLine.split(SINGLE_UNIFIED_DIFF_SECOND_LINE_REGEX),
    ).trim();

    // Then, get the parsed diff info.
    const lineDiffs = parseHgDiffUnifiedOutput(diffOutputForFile);
    // We should always try to use the new file name. If the unified diff piece
    // represents a deletion, the new file path is /dev/null, so we then
    // need to fallback to the old file path.
    filePathToDiffInfo.set(
      newFilePath !== DEV_NULL_FILE_PATH ? newFilePath : oldFilePath,
      lineDiffs,
    );
  }
  return filePathToDiffInfo;
}
