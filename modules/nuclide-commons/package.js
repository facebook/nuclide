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

import fs from 'fs';
import invariant from 'assert';

// Use a regex and not the "semver" module so the result here is the same
// as from python code.
const SEMVERISH_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9.-]+))?$/;

export function getPackageMinorVersion(packageJsonPath: string): string {
  const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const match = SEMVERISH_RE.exec(pkgJson.version);
  invariant(match);
  // const majorVersion = match[1];
  const minorVersion = match[2];
  // const patchVersion = match[3];
  // const prereleaseVersion = match[4];
  return minorVersion;
}
