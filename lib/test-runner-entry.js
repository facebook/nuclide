/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

const {__DEV__} = require('../modules/nuclide-node-transpiler/lib/env');

if (__DEV__) {
  require('../modules/nuclide-node-transpiler');
}

// Atom requires this file without the require interop.
module.exports = require('./test-runner').default;
