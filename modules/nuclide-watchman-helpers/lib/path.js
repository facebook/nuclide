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

import fsPromise from 'nuclide-commons/fsPromise';

const WATCHMAN_DEFAULT_PATH = '/usr/local/bin/watchman';

export async function getWatchmanBinaryPath(): Promise<string> {
  try {
    const stats = await fsPromise.stat(WATCHMAN_DEFAULT_PATH);
    // `stats` contains a `mode` property, a number which can be used to determine
    // whether this file is executable. However, the number is platform-dependent.
    if (stats && stats.isFile()) {
      return WATCHMAN_DEFAULT_PATH;
    }
  } catch (e) {
    // Suppress the error.
  }
  // Let the watchman Client find the watchman binary via the default env PATH.
  return 'watchman';
}
