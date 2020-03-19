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

// Load v8-compile-cache.
require('v8-compile-cache');

// Load the transpiler.
require('../../commons-node/load-transpiler');

// Load the big-dig entry point.
const {
  parseArgsAndRunMain,
} = require('../../../modules/big-dig/src/server/cli');

// .. and tell it to load the Nuclide server.
const absolutePathToServerMain = require.resolve('./server');
parseArgsAndRunMain(absolutePathToServerMain).catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
