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

module.exports = {
  rules: {
    'api-spelling': require('./api-spelling'),
    'atom-apis': require('./atom-apis'),
    'consistent-import-name': require('./consistent-import-name'),
    'disallowed-modules': require('./disallowed-modules'),
    'dom-apis': require('./dom-apis'),
    'flow-fb-oss': require('./flow-fb-oss'),
    'import-type-style': require('./import-type-style'),
    'jsx-simple-callback-refs': require('./jsx-simple-callback-refs'),
    'license-header': require('./license-header'),
    'modules-dependencies': require('./modules-dependencies'),
    'no-commonjs': require('./no-commonjs'),
    'no-cross-atom-imports': require('./no-cross-atom-imports'),
    'no-fb-deps-from-oss': require('./no-fb-deps-from-oss'),
    'no-unnecessary-disposable-wrapping': require('./no-unnecessary-disposable-wrapping'),
    'no-unobserved-gk': require('./no-unobserved-gk'),
    'no-unresolved': require('./no-unresolved'),
    'prefer-nuclide-uri': require('./prefer-nuclide-uri'),
    'react-virtualized-import': require('./react-virtualized-import'),
    'require-universal-disposable': require('./require-universal-disposable'),
    'use-nuclide-ui-components': require('./use-nuclide-ui-components'),
    'unused-subscription': require('./unused-subscription'),
  },
  rulesConfig: {
    'api-spelling': 0,
    'atom-apis': 0,
    'consistent-import-name': 0,
    'disallowed-modules': 0,
    'dom-apis': 0,
    'flow-fb-oss': 0,
    'import-type-style': 0,
    'jsx-simple-callback-refs': 0,
    'license-header': 0,
    'modules-dependencies': 0,
    'no-cross-atom-imports': 0,
    'no-fb-deps-from-oss': 0,
    'no-unnecessary-disposable-wrapping': 0,
    'no-unobserved-gk': 0,
    'no-unresolved': 0,
    'prefer-nuclide-uri': 0,
    'react-virtualized-import': 0,
    'require-universal-disposable': 0,
    'use-nuclide-ui-components': 0,
    'unused-subscription': 0,
  },
};
