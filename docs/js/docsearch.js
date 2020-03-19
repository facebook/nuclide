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

/* eslint-disable no-var */
/* eslint-disable no-undef */

// For Algolia search
(function() {
  // Algolia
  docsearch({
    apiKey: '421f79d033cee73a376aba52e4f572eb',
    indexName: 'nuclide',
    inputSelector: '#algolia-doc-search',
  });
})();
