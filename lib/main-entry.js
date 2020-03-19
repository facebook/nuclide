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

try {
  // $FlowFB
  require('./fb-addReactDOMProfiling');
} catch (err) {
  // Only swallow errors about the module not existing.
  if (typeof err !== 'object' || err.code !== 'MODULE_NOT_FOUND') {
    throw err;
  }
}

const {__DEV__} = require('../modules/nuclide-node-transpiler/lib/env');

if (__DEV__) {
  require('../modules/nuclide-node-transpiler');

  // The require profiling is really noisy during tests.
  if (!atom.inSpecMode()) {
    require('./internal/track-nuclide-ready').init({
      byLoadOrder: false,
      loadOrderMinDuration: 10,
      byRoot: true,
    });
  }
}

module.exports = require('./main');
