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

const path = require('path');
const resolveFrom = require('resolve-from');

// eslint-disable-next-line nuclide-internal/modules-dependencies
const pkgJson = require('../../package.json');
const {isRequire, ATOM_BUILTIN_PACKAGES} = require('./utils');
const MODULES_DIR = path.dirname(__dirname);

module.exports = function(context) {
  function checkDependency(node, id) {
    const filename = context.getFilename();
    const resolvedPath = resolveFrom(path.dirname(filename), id);
    if (
      !id.startsWith('.') &&
      !id.includes('/') &&
      !ATOM_BUILTIN_PACKAGES.has(id) &&
      !pkgJson.dependencies.hasOwnProperty(id) &&
      // We rewrite imports from rxjs to be from rxjs-compat
      !(id === 'rxjs' && pkgJson.dependencies.hasOwnProperty('rxjs-compat')) &&
      !filename.includes('/spec/') &&
      !filename.includes('/scripts/') &&
      !filename.includes('.eslintrc.js') &&
      resolvedPath !== id &&
      (resolvedPath == null || !resolvedPath.startsWith(MODULES_DIR))
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
