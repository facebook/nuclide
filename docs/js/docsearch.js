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
  rulesdir/no-commonjs: 0,
  */

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
