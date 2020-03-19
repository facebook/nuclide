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

import type {ObserveProcessOptions} from './process';

import os from 'os';
import nuclideUri from './nuclideUri';
import {runCommand} from './process';

/**
 * Provides a cross-platform way to check whether a binary is available.
 *
 * We ran into problems with the npm `which` package (the nature of which I unfortunately don't
 * remember) so we can use this for now.
 */

function sanitizePathForWindows(path: string): string {
  if (nuclideUri.basename(path) === path) {
    // simple binary in $PATH like `flow`
    return path;
  } else {
    return `${nuclideUri.dirname(path)}:${nuclideUri.basename(path)}`;
  }
}

export default (async function which(
  path: string,
  options?: ObserveProcessOptions = {},
): Promise<?string> {
  const isWindows = process.platform === 'win32';
  const whichCommand = isWindows ? 'where' : 'which';
  const searchPath = isWindows ? sanitizePathForWindows(path) : path;
  try {
    const result = await runCommand(
      whichCommand,
      [searchPath],
      options,
    ).toPromise();
    return result.split(os.EOL)[0];
  } catch (e) {
    return null;
  }
});
