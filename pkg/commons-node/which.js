/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import {checkOutput} from './process';
import os from 'os';
import nuclideUri from './nuclideUri';

/**
 * Provides a cross-platform way to check whether a binary is available.
 *
 * We ran into problems with the npm `which` package (the nature of which I unfortunately don't
 * remember) so we can use this for now.
 */
export default async function which(path: string): Promise<?string> {
  const isWindows = process.platform === 'win32';
  const whichCommand = isWindows ? 'where' : 'which';
  const searchPath = isWindows ? `${nuclideUri.dirname(path)}:${nuclideUri.basename(path)}` : path;
  try {
    const result = await checkOutput(whichCommand, [searchPath]);
    return result.stdout.split(os.EOL)[0];
  } catch (e) {
    return null;
  }
}
