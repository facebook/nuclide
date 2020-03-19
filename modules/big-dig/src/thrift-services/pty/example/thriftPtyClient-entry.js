/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

/**
 * This is the main insertion point for starting the command line debugger.
 * Note: since this is FB-only we can assume that this is inside of Nuclide.
 */
// eslint-disable-next-line nuclide-internal/modules-dependencies
const {__DEV__} = require('nuclide-node-transpiler/lib/env');
if (__DEV__) {
  // eslint-disable-next-line nuclide-internal/modules-dependencies
  require('nuclide-node-transpiler');
}

// Load the ES6+ client code now that the transpiler is in place.
require('./thriftPtyClient');
