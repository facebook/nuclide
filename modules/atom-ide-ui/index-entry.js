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
  nuclide-internal/no-commonjs: 0,
  */

const fs = require('fs');
const path = require('path');
if (fs.existsSync(path.join(__dirname, 'DEVELOPMENT'))) {
  // eslint-disable-next-line nuclide-internal/modules-dependencies
  require('../../pkg/nuclide-node-transpiler');
}

module.exports = require('./index');
