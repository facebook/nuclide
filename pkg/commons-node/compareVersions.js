/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

/**
 * Compare two version strings. This is much more lax than semver and allows, for example, versions
 * like "9".
 */
export default function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(x => parseInt(x, 10));
  const bParts = b.split('.').map(x => parseInt(x, 10));
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNumber = aParts[i] || 0;
    const bNumber = bParts[i] || 0;
    if (aNumber < bNumber) {
      return -1;
    }
    if (aNumber > bNumber) {
      return 1;
    }
  }
  return 0;
}
