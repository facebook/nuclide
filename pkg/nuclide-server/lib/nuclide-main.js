/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  nuclide-internal/no-commonjs: 0,
  */

// Load v8-compile-cache.
require('v8-compile-cache');

/**
 * This is the main insertion point for starting nuclide-server.
 */
const {__DEV__} = require('../../nuclide-node-transpiler/lib/env');

if (__DEV__) {
  require('../../nuclide-node-transpiler');
}

// Load the ES6+ server code now that the transpiler is in place.
require('./main');
