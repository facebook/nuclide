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

/* eslint comma-dangle: [1, always-multiline], prefer-object-spread/prefer-object-spread: 0 */

const FAKE_DISABLE_RE = /\s*eslint-disable\s+nuclide-internal\/license-header\s*/;

const SHEBANG_RE = /^#!\/usr\/bin\/env node\n/;

const FLOW_FORMAT_AND_TRANSPILE = `\
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
`;

const NO_FLOW_AND_NO_TRANSPILE = `\
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

/* eslint comma-dangle: [1, always-multiline], prefer-object-spread/prefer-object-spread: 0 */
`;

module.exports = function(context) {
  // "eslint-disable" disables rules after it. Since the directives have to go
  // first, we can't use that mechanism to disable this check.
  const comments = context.getAllComments();
  for (let i = 0; i < comments.length; i++) {
    if (FAKE_DISABLE_RE.test(comments[i].value)) {
      return {};
    }
  }

  return {
    Program(node) {
      const sourceCode = context.getSourceCode();
      const source = sourceCode.text;

      if (source.startsWith(FLOW_FORMAT_AND_TRANSPILE)) {
        return;
      }

      if (source.replace(SHEBANG_RE, '').startsWith(NO_FLOW_AND_NO_TRANSPILE)) {
        return;
      }

      context.report({
        node,
        message: 'Expected a license header',
      });
    },
  };
};

module.exports.schema = [];
module.exports.FLOW_FORMAT_AND_TRANSPILE = FLOW_FORMAT_AND_TRANSPILE;
module.exports.NO_FLOW_AND_NO_TRANSPILE = NO_FLOW_AND_NO_TRANSPILE;
