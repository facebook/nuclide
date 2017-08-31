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
  nuclide-internal/no-commonjs: 0,
  */

/* eslint-disable no-console */

module.exports = context => {
  const t = context.types;
  const template = context.template;

  const buildIfThrow = template(`
    if (!$0) {
      throw new Error($1);
    }
  `);

  function replaceInvariant(path) {
    const node = path.node;

    t.assertCallExpression(node);
    t.assertIdentifier(node.callee, {name: 'invariant'});

    if (node.arguments[0] == null) {
      throw path.buildCodeFrameError(
        '`invariant()` must at least one argument.'
      );
    }

    const stmtParent = path.getStatementParent();

    if (stmtParent.type !== 'ExpressionStatement') {
      throw path.buildCodeFrameError(
        '`invariant()` must be used as an expression statement.'
      );
    }

    stmtParent.replaceWith(
      buildIfThrow(
        node.arguments[0],
        node.arguments[1] || t.stringLiteral(
          'Invariant violation: '
          + JSON.stringify(path.get('arguments.0').getSource())
        )
      )
    );
  }

  return {
    visitor: {
      Program: {
        exit(path, state) {
          const binding = path.scope.bindings.invariant;
          // Only import bindings are transformed
          if (binding == null || binding.kind !== 'module') {
            return;
          }
          let removeBinding = true;
          for (const refPath of binding.referencePaths) {
            if (refPath.parentKey !== 'callee' ||
                refPath.parent.type !== 'CallExpression') {
              removeBinding = false;
              continue;
            }
            replaceInvariant(refPath.parentPath);
          }
          if (removeBinding && t.isImportDeclaration(binding.path.parent)) {
            // import invariant from '';
            if (binding.path.parent.specifiers.length === 1) {
              binding.path.parentPath.remove();
            // import invariant, {deepEqual} from '';
            } else {
              binding.path.remove();
            }
          }
        },
      },
    },
  };
};
