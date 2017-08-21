#!/usr/bin/env node
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

// Regenerates the .proxy baseline files in the spec/fixtures directory.

const {__DEV__} = require('../../nuclide-node-transpiler/lib/env');

if (__DEV__) {
  require('../../nuclide-node-transpiler');
}

require('../lib/regenerate-baselines-main');
