/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @emails oncall+nuclide
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

const child_process = require('child_process');

describe('require-hook', () => {
  it('works', () => {
    // This test runs in a new process because it monkey-patches `require` and
    // we don't want to pollute the test environment.
    const ret = child_process.spawnSync(process.execPath, [
      require.resolve('../__mocks__/fixtures/require-hook-test'),
    ]);
    expect(ret.status).toBe(0);
    expect(String(ret.stdout).trim()).toBe('OK');
    expect(String(ret.stderr).trim()).toBe('');
  });
});
