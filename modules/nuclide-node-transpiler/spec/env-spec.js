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

const fs = require('fs');
const path = require('path');

describe('env', () => {
  it('has correct __DEV__', () => {
    // This should exist if we're running a test.
    expect(fs.existsSync(path.join(__dirname, '../../../DEVELOPMENT'))).toBe(true);
    expect(require('../lib/env').__DEV__).toBe(true);
  });
});
