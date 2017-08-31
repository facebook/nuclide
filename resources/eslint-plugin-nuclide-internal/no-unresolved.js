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

const path = require('path');
const resolveFrom = require('resolve-from');

const pkgJson = require('../../package.json');
const {isRequire, ATOM_BUILTIN_PACKAGES} = require('./utils');

module.exports = function(context) {
  function checkDependency(node, id) {
    const filename = context.getFilename();
    if (
      !id.startsWith('.') &&
      !id.includes('/') &&
      !ATOM_BUILTIN_PACKAGES.has(id) &&
      !pkgJson.dependencies.hasOwnProperty(id) &&
      (!filename.includes('/spec/') ||
        !pkgJson.devDependencies.hasOwnProperty(id)) &&
      !filename.includes('/scripts/') &&
      resolveFrom(path.dirname(filename), id) !== id
    ) {
      context.report({
        node,
        data: {id},
        message: '"{{id}}" must be a dependency in the root package.json',
      });
    }
  }

  return {
    ImportDeclaration(node) {
      if (node.importKind !== 'type') {
        checkDependency(node, node.source.value);
      }
    },
    VariableDeclarator(node) {
      if (isRequire(node.init)) {
        checkDependency(node, node.init.arguments[0].value);
      }
    },
  };
};
