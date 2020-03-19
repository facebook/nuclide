/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

type MatchRange = [/* start */ number, /* end */ number];

export default function matchIndexesToRanges(
  matchIndexes: Array<number>,
): Array<MatchRange> {
  let streakOngoing = false;
  let start = 0;
  const ranges = [];

  // Collapse consecutive values for consecutive indexes into range pairs.
  // Do this in O(n) where n is the number of matchIndexes (ie. less than the length of the path).
  matchIndexes.forEach((i, n) => {
    if (matchIndexes[n + 1] === i + 1) {
      if (!streakOngoing) {
        start = i;
        streakOngoing = true;
      }
    } else {
      if (streakOngoing) {
        ranges.push([start, i + 1]);
        streakOngoing = false;
      } else {
        ranges.push([i, i + 1]);
      }
      start = i + 1;
    }
  });
  return ranges;
}
