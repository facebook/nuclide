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

const {isRequire} = require('./utils');

// It would be nice if we could just use eslint-plugin-import, but we actually want to use
// `module.exports` in all of our `main.js` files (just not in assignment expressions), so we need
// some custom logic.
module.exports = function(context) {
  return {
    CallExpression(node) {
      if (context.getScope().type !== 'module') {
        return;
      }
      if (isRequire(node)) {
        context.report({
          node,
          message: 'Use "import" instead of "require"',
        });
      }
    },
    AssignmentExpression(node) {
      if (isModuleDotExportsAssignment(node)) {
        context.report({
          node,
          message: 'Use "export" instead of "module.exports"',
        });
      }
    },
  };
};

function isModuleDotExportsAssignment(node) {
  if (!node || node.type !== 'AssignmentExpression') {
    return;
  }

  const {left} = node;

  // `module.exports = ...`
  if (isModuleDotExports(left)) {
    return true;
  }

  // `module.exports.whatever = ...`
  if (
    left.type === 'MemberExpression' &&
    left.object &&
    isModuleDotExports(left.object)
  ) {
    return true;
  }

  return false;
}

function isModuleDotExports(node) {
  return (
    node.type === 'MemberExpression' &&
    node.object &&
    node.object.type === 'Identifier' &&
    node.object.name === 'module' &&
    node.property &&
    node.property.type === 'Identifier' &&
    node.property.name === 'exports'
  );
}
