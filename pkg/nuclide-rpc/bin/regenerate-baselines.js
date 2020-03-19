#!/usr/bin/env node
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

// Regenerates the .proxy baseline files in the spec/fixtures directory.

require('../../commons-node/load-transpiler');

require('../lib/regenerate-baselines-main');
