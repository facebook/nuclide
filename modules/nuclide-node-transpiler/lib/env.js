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

const path = require('path');
const fs = require('fs');

// This script is required by every entry point in Nuclide.
// Use this as an opportunity to inject the 'modules' path.
process.env.NODE_PATH =
  (process.env.NODE_PATH || '') +
  path.delimiter +
  path.join(__dirname, '../../../modules');
require('module').Module._initPaths();

module.exports.__DEV__ = fs.existsSync(path.join(__dirname, '../../../DEVELOPMENT'));
