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

/**
 * Matches a hunk summary line as specified in the unified diff format.
 * Explained here: http://www.gnu.org/software/diffutils/manual/html_node/Detailed-Unified.html
 * and here: http://www.artima.com/weblogs/viewpost.jsp?thread=164293.
 */
const HUNK_DIFF_REGEX = /@@ .* @@/g;
const HUNK_OLD_INFO_REGEX = /-([0-9]+)((?:,[0-9]+)?)/;
const HUNK_NEW_INFO_REGEX = /\+([0-9]+)((?:,[0-9]+)?)/;

import os from 'os';
import type {DiffInfo} from './HgService';

/**
 * Parses the output of `hg diff --unified 0`.
 */
export function parseHgDiffUnifiedOutput(output: string): DiffInfo {
  const diffInfo = {
    added: 0,
    deleted: 0,
    lineDiffs: [],
  };
  if (!output) {
    return diffInfo;
  }
  const diffHunks = output.match(HUNK_DIFF_REGEX);
  // $FlowFixMe diffHunks may be null
  diffHunks.forEach(hunk => {
    // `hunk` will look like: "@@ -a(,b) +c(,d) @@"
    const hunkParts = hunk.split(' ');
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

    diffInfo.added += newLines;
    diffInfo.deleted += oldLines;
    diffInfo.lineDiffs.push({oldStart, oldLines, newStart, newLines});
  });

  return diffInfo;
}

const SINGLE_UNIFIED_DIFF_BEGINNING_REGEX = /--- /;

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
    // First, extract the file name. The first line of the string should be the file path.
    const newLineChar = os.EOL;
    const firstNewline = diffOutputForFile.indexOf(newLineChar);
    let filePath = diffOutputForFile.slice(0, firstNewline);
    filePath = filePath.trim();
    // Then, get the parsed diff info.
    const lineDiffs = parseHgDiffUnifiedOutput(diffOutputForFile);

    filePathToDiffInfo.set(filePath, lineDiffs);
  }
  return filePathToDiffInfo;
}
