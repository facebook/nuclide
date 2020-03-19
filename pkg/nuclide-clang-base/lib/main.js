/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import featureConfig from 'nuclide-commons-atom/feature-config';

// Matches string defined in fb-cquery/lib/main.js.
const USE_CQUERY_CONFIG = 'fb-cquery.use-cquery';

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = {
  // If true, skip calling to clang service for given path.
  checkCqueryOverride: async (path: string): Promise<boolean> => {
    return featureConfig.get(USE_CQUERY_CONFIG) === true;
  },
};
