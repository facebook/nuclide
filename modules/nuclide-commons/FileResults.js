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

import {Range} from 'atom';

export type LineGroup = {
  startLine: number,
  lines: Array<string>,
  matches: Array<atom$Range>,
};

export class FileResults {
  path: string;
  groups: Array<LineGroup>;
  pathMatch: ?[number, number];

  constructor(
    path: string,
    groups: Array<LineGroup>,
    pathMatch?: [number, number],
  ) {
    this.path = path;
    this.groups = groups;
    this.pathMatch = pathMatch;
  }

  // Apply a grep filter to all line groups, splitting into new groups as necessary.
  // Pass `invert = true` to invert the grep filter.
  // When invert is false, regex match ranges will be added to each group's list of matches.
  filterGroups(regex: RegExp, invert: boolean): Array<LineGroup> {
    const filtered = [];
    this.groups.forEach(group => {
      let lines = [];
      let matches = [];
      let startLine = -1;
      let curMatch = 0;
      for (let i = 0; i < group.lines.length; i++) {
        const line = group.lines[i];
        const lineNum = group.startLine + i - 1;
        // $FlowFixMe (>= v0.75.0)
        const regexMatch: RegExp$matchResult = regex.exec(line);
        const matched = (regexMatch == null) === invert;
        // Keep all the existing match ranges only if the regex matched.
        while (
          curMatch < group.matches.length &&
          group.matches[curMatch].start.row === lineNum
        ) {
          if (matched) {
            matches.push(group.matches[curMatch]);
          }
          curMatch++;
        }
        if (!matched) {
          // A non-match means that we should split into a new group, if necessary.
          if (lines.length !== 0) {
            filtered.push({startLine, lines, matches});
            lines = [];
            matches = [];
          }
        } else {
          if (lines.length === 0) {
            startLine = lineNum + 1;
          }
          lines.push(line);
          // For non-invert matches, additionally highlight the first regex match.
          if (!invert) {
            const filterMatch = new Range(
              [lineNum, regexMatch.index],
              [lineNum, regexMatch.index + regexMatch[0].length],
            );
            // Keep `matches` sorted via insertion sort.
            // This does not cause quadratic runtime, since this will only scan the previous line.
            for (let j = matches.length; j >= 0; j--) {
              if (j === 0 || matches[j - 1].compare(filterMatch) <= 0) {
                matches.splice(j, j, filterMatch);
                break;
              }
            }
          }
        }
      }
      // Finish off the current group.
      if (lines.length !== 0) {
        filtered.push({startLine, lines, matches});
      }
    });
    return filtered;
  }

  // Applies the grep filter to both filename and line groups.
  // Returns null if neither filename or line contents match.
  applyGrep(regex: RegExp, invert: boolean): ?FileResults {
    const {path} = this;
    if (invert && regex.exec(path) != null) {
      return null;
    }
    const groups = this.filterGroups(regex, invert);
    if (groups.length === 0) {
      const fileMatch = regex.exec(path);
      if ((fileMatch == null) !== invert) {
        return null;
      }
      if (fileMatch != null) {
        return new FileResults(path, groups, [
          fileMatch.index,
          fileMatch.index + fileMatch[0].length,
        ]);
      }
    }
    return new FileResults(path, groups);
  }
}
