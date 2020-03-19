/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @format
 */
'use strict';

/* eslint nuclide-internal/no-commonjs: 0 */

/**
 * To use the require hook, you should follow this pattern:
 *
 *   const {__DEV__} = require('<relative_path>/nuclide-node-transpiler/lib/env');
 *   if (__DEV__) {
 *     require('nuclide-node-transpiler');
 *   }
 *
 * It's important that the lib/env path is relative, as that file is the one
 * responsible for injecting the modules/ require path!
 */

const {__DEV__} = require('./env');

if (__DEV__) {
  require('./require-hook');
} else {
  throw new Error('The require hook can only be enabled in __DEV__ mode.');
}
