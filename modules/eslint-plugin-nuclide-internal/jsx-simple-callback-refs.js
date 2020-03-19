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

/**
 * There's a potentially big footgun that can come from using arrow functions for callback refs. It
 * boils down to [this](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs):
 *
 *    If the `ref` callback is defined as an inline function, it will get called twice during
 *    updates, first with `null` and then again with the DOM element. This is because a new instance
 *    of the function is created with each render, so React needs to clear the old ref and set up
 *    the new one. You can avoid this by defining the `ref` callback as a bound method on the class,
 *    but note that it shouldn’t matter in most cases.
 *
 * If you're doing non-trivial work in your callback, having it called on every render (instead of
 * just mount/unmount) could be a Big Deal. Hence, this lint rule. If you need to do something other
 * than a simple assignment, extract it into a method so that referential equality is preserved
 * between renders.
 */
module.exports = function(context) {
  return {
    JSXAttribute(node) {
      if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'ref') {
        return;
      }

      const expression =
        node.value.type === 'JSXExpressionContainer'
          ? node.value.expression
          : null;

      if (expression == null) {
        return;
      }

      // Cool. Methods are good.
      if (isMethodExpression(expression)) {
        return;
      }

      // Simple assignments are cool.
      if (isAssignmentExpression(expression)) {
        return;
      }

      context.report({
        node,
        message:
          'Callback refs must be either methods or arrow functions with simple assignments.',
      });
    },
  };
};

function isMethodExpression(expression) {
  return (
    expression.type === 'MemberExpression' &&
    expression.object.type === 'ThisExpression' &&
    expression.property.type === 'Identifier'
  );
}

function isAssignmentExpression(expression) {
  if (
    expression.type === 'ArrowFunctionExpression' &&
    expression.body.type === 'AssignmentExpression'
  ) {
    return true;
  }
  if (
    expression.type === 'ArrowFunctionExpression' &&
    expression.body.type === 'BlockStatement'
  ) {
    if (expression.body.body.length !== 1) {
      return false;
    }
    const bodyExpression =
      expression.body.body[0].type === 'ExpressionStatement'
        ? expression.body.body[0].expression
        : null;
    return (
      bodyExpression != null && bodyExpression.type === 'AssignmentExpression'
    );
  }
  return false;
}
