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
const vm = require('vm');
// eslint-disable-next-line nuclide-internal/modules-dependencies
const waitsFor = require('../../../jest/waits_for').default;
const path = require('path');
const NODE_BIN = path.resolve(
  __dirname,
  '../../../../third-party/node/bin/node',
);

describe('bin-transpile', () => {
  it('transpiles one file', async () => {
    const ps = child_process.spawn(NODE_BIN, [
      require.resolve('../bin/transpile.js'),
      require.resolve('../__mocks__/fixtures/modern-syntax'),
    ]);

    let out = '';
    let err = '';
    ps.stdout.on('data', buf => {
      out += buf;
    });
    ps.stderr.on('data', buf => {
      err += buf;
    });

    let ran = false;
    ps.on('close', () => {
      expect(err).toBe('');

      const c = {exports: {}};
      vm.runInNewContext(out, c);
      expect(c.exports.Foo.bar).toBe('qux');

      ran = true;
    });

    await waitsFor(() => ran);
  });
});
