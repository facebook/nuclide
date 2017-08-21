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
  nuclide-internal/no-commonjs: 0,
  */

/**
 * TODO(hansonw): Remove this rule if this bugfix PR gets merged:
 * https://github.com/substack/node-shell-quote/pull/29
 */

module.exports = function(context) {
  return {
    ImportDeclaration(node) {
      if (node.source.value === 'shell-quote') {
        context.report({
          node,
          message:
            'Use shellQuote and shellParse from nuclide-commons/string instead of "shell-quote"',
        });
      }
    },
  };
};
