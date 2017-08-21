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
 * This rule prevents unnecessary wrapping of disposables in `new UniversalDisposable` expressions.
 * (e.g. `new UniversalDisposable(new Disposable())`). It doesn't prevent adding an existing
 * UniversalDisposable to another one as there are cases where that could be useful.
 */

module.exports = function(context) {
  return {
    NewExpression(node) {
      if (!isNewUniversalDisposableExpression(node)) { return; }
      for (let i = 0; i < node.arguments.length; i++) {
        const nodeArg = node.arguments[i];
        if (!isNewDisposableExpression(nodeArg)) { continue; }
        context.report({
          node: nodeArg,
          message: 'Unnecessary Disposable wrapping',
          fix(fixer) {
            if (nodeArg.arguments.length === 0) {
              // This is rare and complicated to remove correctly because you
              // have to worry about commas.
              return;
            }
            const source = context.getSourceCode();
            return fixer.replaceText(
              nodeArg,
              source.text.slice(
                nodeArg.arguments[0].range[0],
                nodeArg.arguments[nodeArg.arguments.length - 1].range[1]
              )
            );
          },
        });
      }
    },
  };
};

function isNewUniversalDisposableExpression(node) {
  return (
    node.type === 'NewExpression'
    && node.callee.type === 'Identifier'
    && node.callee.name === 'UniversalDisposable'
  );
}

function isNewDisposableExpression(node) {
  if (node.type !== 'NewExpression' || node.callee.type !== 'Identifier') {
    return;
  }
  switch (node.callee.name) {
    case 'UniversalDisposable':
    case 'Disposable':
    case 'CompositeDisposable':
      return true;
    default:
      return false;
  }
}
