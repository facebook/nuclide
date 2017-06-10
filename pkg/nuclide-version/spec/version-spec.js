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

import {getVersion} from '..';
import fs from 'fs';
import semver from 'semver';

describe('getVersion', () => {
  it('should be a number string', () => {
    const version = getVersion();
    expect(typeof version).toBe('string');
    expect(/^\d+$/.test(version)).toBe(true);
  });

  it('should be semver valid', () => {
    // Since the regex in "getVersion" is not strict semver (so that it can be
    // read in python) this test enforces that it is truly semver valid.
    const version = getVersion();
    const pkgFilename = require.resolve('../../../package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgFilename, 'utf8'));
    expect(semver.valid(pkgJson.version)).not.toBe(null);
    expect(String(semver.minor(pkgJson.version))).toBe(version);
  });
});
