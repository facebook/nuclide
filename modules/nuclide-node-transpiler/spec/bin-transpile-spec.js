/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  rulesdir/no-commonjs: 0,
  */

const child_process = require('child_process');
const vm = require('vm');

describe('bin-transpile', () => {
  it('transpiles one file', () => {
    const ps = child_process.spawn(
      require.resolve('../bin/transpile.js'),
      [require.resolve('./fixtures/modern-syntax')]
    );

    let out = '';
    let err = '';
    ps.stdout.on('data', buf => { out += buf; });
    ps.stderr.on('data', buf => { err += buf; });

    let ran = false;
    ps.on('close', () => {
      expect(err).toBe('');

      const c = {exports: {}};
      vm.runInNewContext(out, c);
      expect(c.exports.Foo.bar).toBe('qux');

      ran = true;
    });

    waitsFor(() => ran);
  });
});
