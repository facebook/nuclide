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

const MINIFIED_LIBS = new Map([
  ['rxjs', 'rxjs/bundles/Rx.min.js'],
]);

module.exports = context => {
  const t = context.types;

  function replaceModuleId(state, source) {
    if (state.ranUseMinifiedLibs) {
      return;
    }
    t.assertStringLiteral(source);
    const id = source.node.value;
    for (const minifiedLib of MINIFIED_LIBS) {
      const name = minifiedLib[0];
      const replacement = minifiedLib[1];
      if (id === name) {
        source.replaceWith(t.stringLiteral(replacement));
        break;
      } else if (id.startsWith(name + '/')) {
        throw source.buildCodeFrameError(`Only importing "${name}" is supported. ${id}`);
      }
    }
  }

  return {
    visitor: {
      CallExpression(path) {
        const node = path.node;
        // "require.resolve" is not checked.
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments[0] &&
          node.arguments[0].type === 'StringLiteral'
        ) {
          const source = path.get('arguments.0');
          replaceModuleId(this, source);
        }
      },
      ImportDeclaration(path) {
        const node = path.node;
        if (node.importKind !== 'type') {
          const source = path.get('source');
          replaceModuleId(this, source);
        }
      },
      'ExportAllDeclaration|ExportNamedDeclaration'(path) {
        const node = path.node;
        if (node.exportKind !== 'type' && node.source != null) {
          const source = path.get('source');
          replaceModuleId(this, source);
        }
      },
      Program: {
        exit(path) {
          // Avoid re-running this transform when doing multiple passes.
          // inline-imports-commonjs does a requeue on `import`s.
          this.ranUseMinifiedLibs = true;
        },
      },
    },
  };
};
