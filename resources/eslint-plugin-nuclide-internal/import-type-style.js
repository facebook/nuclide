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

const DEFAULT_TYPE_POSTFIX = 'Type';

function endWithTypePostfix(value) {
  return value.length > DEFAULT_TYPE_POSTFIX.length &&
    value.lastIndexOf(DEFAULT_TYPE_POSTFIX) === value.length - DEFAULT_TYPE_POSTFIX.length;
}

module.exports = function(context) {
  function checkIdentifier(ident) {
    if (!endWithTypePostfix(ident.name)) {
      context.report({
        node: ident,
        data: {suggest: ident.name + DEFAULT_TYPE_POSTFIX},
        message: 'Import type should be aliased as {{suggest}}',
      });
    }
  }

  return {
    ImportNamespaceSpecifier(node) {
      if (node.parent.importKind !== 'type') {
        return;
      }
      checkIdentifier(node.local);
    },
    ImportSpecifier(node) {
      if (node.parent.importKind !== 'type') {
        return;
      }
      if (!node.imported || node.local.name === node.imported.name) {
        return;
      }
      checkIdentifier(node.local);
    },
  };
};
