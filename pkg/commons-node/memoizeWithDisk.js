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

import crypto from 'crypto';
import fs from 'fs';
import fsPlus from 'fs-plus';
import os from 'os';
import nuclideUri from 'nuclide-commons/nuclideUri';

const CACHE_DIR = 'nuclide-cache';

function getCachePath(key: string, cacheDir?: string) {
  const sha1 = crypto
    .createHash('sha1')
    .update(key)
    .digest('hex');
  if (cacheDir != null) {
    return nuclideUri.join(cacheDir, sha1 + '.json');
  }
  return nuclideUri.join(os.tmpdir(), CACHE_DIR, sha1 + '.json');
}

/**
 * Similar to lodash.memoize in that it caches the result of a function, but it'll work on disk.
 * Note that this is synchronous to preserve the original function signature, but there could
 * be an asynchronous version as well (though race conditions are tricky).
 *
 * Requirements:
 * - T must be JSON-serializable/deserializable.
 * - ArgsType must be either be JSON-serializable, or a keySelector must be provided which
 *   *does* return a JSON-serializable value.
 *   Unlike lodash.memoize, this uses the result of JSON.stringify(args) if no
 *   keySelector is provided.
 */
export default function memoizeWithDisk<ArgsType: Iterable<*>, T>(
  func: (...args: ArgsType) => T,
  keySelector?: (...args: ArgsType) => mixed,
  cacheDir?: string,
): (...args: ArgsType) => T {
  return (...args) => {
    const key = keySelector != null ? keySelector(...args) : args;
    // Include the function string as well to prevent collisions from multiple functions.
    const fullKey = JSON.stringify([func.toString(), key]);
    const cachePath = getCachePath(fullKey, cacheDir);
    try {
      const cacheContents = fs.readFileSync(cachePath, 'utf8');
      return JSON.parse(cacheContents);
    } catch (err) {
      // An error implies that the cached value does not exist.
      const result = func(...args);
      try {
        // fsPlus.writeFileSync creates the directory if necessary.
        fsPlus.writeFileSync(cachePath, JSON.stringify(result), 'utf8');
      } catch (_) {
        // Ignore errors here.
      }
      return result;
    }
  };
}
