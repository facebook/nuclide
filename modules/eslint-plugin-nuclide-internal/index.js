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
  rulesdir/no-commonjs: 0,
  */

module.exports = {
  rules: {
    'atom-apis': require('./atom-apis'),
    'consistent-import-name': require('./consistent-import-name'),
    'disallowed-modules': require('./disallowed-modules'),
    'dom-apis': require('./dom-apis'),
    'flow-fb-oss': require('./flow-fb-oss'),
    'import-type-style': require('./import-type-style'),
    'license-header': require('./license-header'),
    'modules-dependencies': require('./modules-dependencies'),
    'no-commonjs': require('./no-commonjs'),
    'no-cross-atom-imports': require('./no-cross-atom-imports'),
    'no-unnecessary-disposable-wrapping': require('./no-unnecessary-disposable-wrapping'),
    'no-unresolved': require('./no-unresolved'),
    'prefer-nuclide-uri': require('./prefer-nuclide-uri'),
    'use-nuclide-ui-components': require('./use-nuclide-ui-components'),
  },
  rulesConfig: {
    'atom-apis': 0,
    'consistent-import-name': 0,
    'disallowed-modules': 0,
    'dom-apis': 0,
    'flow-fb-oss': 0,
    'import-type-style': 0,
    'license-header': 0,
    'modules-dependencies': 0,
    'no-cross-atom-imports': 0,
    'no-unnecessary-disposable-wrapping': 0,
    'no-unresolved': 0,
    'prefer-nuclide-uri': 0,
    'use-nuclide-ui-components': 0,
  },
};
