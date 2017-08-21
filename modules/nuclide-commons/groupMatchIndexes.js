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

export default function groupMatchIndexes<T>(
  str: string,
  matchIndexes: Array<number>,
  matchFn: (string, number | string) => T,
  unmatchedFn: (string, number | string) => T,
): Array<T> {
  let streakOngoing = false;
  let start = 0;
  const pathComponents = [];

  // Split the path into highlighted and non-highlighted subsequences for optimal rendering perf.
  // Do this in O(n) where n is the number of matchIndexes (ie. less than the length of the path).
  matchIndexes.forEach((i, n) => {
    if (matchIndexes[n + 1] === i + 1) {
      if (!streakOngoing) {
        if (start < i) {
          pathComponents.push(unmatchedFn(str.slice(start, i), i));
        }
        start = i;
        streakOngoing = true;
      }
    } else {
      if (streakOngoing) {
        pathComponents.push(matchFn(str.slice(start, i + 1), i));
        streakOngoing = false;
      } else {
        if (start < i) {
          pathComponents.push(unmatchedFn(str.slice(start, i), `before${i}`));
        }
        pathComponents.push(matchFn(str.slice(i, i + 1), i));
      }
      start = i + 1;
    }
  });
  if (start < str.length) {
    pathComponents.push(unmatchedFn(str.slice(start, str.length), 'last'));
  }
  return pathComponents;
}
