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

const path = require('path');
const resolveFrom = require('resolve-from');

// eslint-disable-next-line rulesdir/modules-dependencies
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
      !filename.includes('.eslintrc.js') &&
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
