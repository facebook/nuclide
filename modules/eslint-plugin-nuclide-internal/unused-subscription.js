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

const ALLOWED_METHODS = new Set(['takeUntil', 'takeWhile']);

// Look for an allowed method in the object tree of the member expression.
// For example: a.takeUntil(disposed).subscribe(...) is allowed.
function hasAllowedObjectExpression(memberExpression) {
  const {property, object} = memberExpression;
  if (property.type === 'Identifier' && ALLOWED_METHODS.has(property.name)) {
    return true;
  } else if (
    object.type === 'CallExpression' &&
    object.callee.type === 'MemberExpression'
  ) {
    return hasAllowedObjectExpression(object.callee);
  }
  return false;
}

module.exports = function(context) {
  // Match 'ExpressionStatement' > 'CallExpression' > 'MemberExpression'
  return {
    MemberExpression: expr => {
      if (expr.property.name === 'subscribe') {
        const ancestors = context.getAncestors();
        if (ancestors.length > 2) {
          const parent = ancestors[ancestors.length - 1];
          const grandparent = ancestors[ancestors.length - 2];
          // Only report if the subscribe method has arguments and appears
          // directly under the ExpressionStatement node, so it's not
          // part of a return statement or argument to another method.
          if (
            parent.type === 'CallExpression' &&
            grandparent.type === 'ExpressionStatement' &&
            parent.arguments.length > 0 &&
            !hasAllowedObjectExpression(expr)
          ) {
            context.report({
              node: expr,
              message: 'Unused result of subscribe()',
            });
          }
        }
      }
    },
  };
};
