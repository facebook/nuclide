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

// Note that loading nuclide-node-transpiler is only necessary if we are
// developing against the dev version of big-dig.
// eslint-disable-next-line nuclide-internal/modules-dependencies
require('../../../pkg/nuclide-node-transpiler');

const {setupDefaultLogging} = require('./logging');
setupDefaultLogging('big-dig-samples-cli-server.log');

const {parseArgsAndRunMain} = require('big-dig/src/server/cli');

const absolutePathToServerMain = require.resolve('./echo-server');
parseArgsAndRunMain(absolutePathToServerMain);
