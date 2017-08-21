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

import os from 'os';

import {runCommand} from './process';

/**
 * Provides a cross-platform way to check whether a binary is available.
 *
 * We ran into problems with the npm `which` package (the nature of which I unfortunately don't
 * remember) so we can use this for now.
 */
export default (async function which(command: string): Promise<?string> {
  const whichCommand = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = await runCommand(whichCommand, [command]).toPromise();
    return result.split(os.EOL)[0];
  } catch (e) {
    return null;
  }
});
