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
  module.exports = require('./fb-analytics/jest_analytics_reporter');
} catch (e) {
  module.exports = class EmptyReporter {};
}
