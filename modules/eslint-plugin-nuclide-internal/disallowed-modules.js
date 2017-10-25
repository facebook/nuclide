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

const DISALLOWED_MODULES = new Map([
  ['invariant', '"assert"'],
  // TODO(hansonw): Remove this if this bugfix PR gets merged:
  // https://github.com/substack/node-shell-quote/pull/29
  ['shell-quote', 'shellQuote and shellParse from nuclide-commons/string'],
]);

module.exports = function(context) {
  return {
    ImportDeclaration(node) {
      const name = node.source.value;
      const descriptionOfAlternative = DISALLOWED_MODULES.get(name);
      if (descriptionOfAlternative != null) {
        context.report({
          node,
          message:
            `Use ${descriptionOfAlternative} instead of "${name}"`,
        });
      }
    },
  };
};
