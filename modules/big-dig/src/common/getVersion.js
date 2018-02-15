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

// eslint-disable-next-line
import {getPackageMinorVersion} from 'nuclide-commons/package';

let version;

export function getVersion(): string {
  if (!version) {
    // Don't use require() because it may be reading from the module cache.
    // Do use require.resolve so the paths can be codemoded in the future.
    const packageJsonPath = require.resolve('../../package.json');
    version = getPackageMinorVersion(packageJsonPath);
  }
  return version;
}
