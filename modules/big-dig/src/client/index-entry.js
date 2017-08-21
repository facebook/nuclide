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

/**
 * This is the equivalent of an index.js file that exports everything of
 * interest in this directory, but makes sure to transpile it first. This
 * makes it easier to test this code locally without an explicit build step.
 */
require('../../loadTranspiler');
const {SshHandshake} = require('./SshHandshake');
const createBigDigClient = require('./createBigDigClient').default;

module.exports.SshHandshake = SshHandshake;
module.exports.createBigDigClient = createBigDigClient;

