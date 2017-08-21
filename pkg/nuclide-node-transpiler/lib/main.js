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

/**
 * To use the require hook, you should follow this pattern:
 *
 *   const {__DEV__} = require('nuclide-node-transpiler/lib/env');
 *   if (__DEV__) {
 *     require('nuclide-node-transpiler');
 *   }
 *
 */

const {__DEV__} = require('./env');

if (__DEV__) {
  require('./require-hook');
} else {
  throw new Error('The require hook can only be enabled in __DEV__ mode.');
}
