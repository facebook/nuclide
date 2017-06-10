/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import {getLogger} from 'log4js';

const logger = getLogger('nuclide-fuzzy-native');

// Use the pre-built, native module if available.
// If not, use the fallback JS implementation.
try {
  module.exports = require('nuclide-prebuilt-libs/fuzzy-native');
} catch (e) {
  logger.error(
    'Failed to load native fuzzy matching. Falling back to JS implementation',
    e,
  );
  module.exports = require('./FallbackMatcher');
}
