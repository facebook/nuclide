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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

/**
 * Copy of the npm package: blocked, but without the unref, because that doesn't work in apm tests.
 * https://github.com/tj/node-blocked/blob/master/index.js
 *
 * The blocked module checks and reports every event loop block time over a given threshold.
 * @return the interval handler.
 * To cancel, call clearInterval on the returned interval handler.
 */
export default function blocked(
  fn: (ms: number) => void,
  intervalMs: number = 100,
  thresholdMs: number = 50,
): IDisposable {
  let start = Date.now();

  const interval: any = setInterval(() => {
    const deltaMs = Date.now() - start;
    const blockTimeMs = deltaMs - intervalMs;
    if (blockTimeMs > thresholdMs) {
      fn(blockTimeMs);
    }
    start = Date.now();
  }, intervalMs);

  return new UniversalDisposable(() => clearInterval(interval));
}
