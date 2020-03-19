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

const idx = require('idx');
const path = require('path');
const resolveFrom = require('resolve-from');

const {
  ATOM_BUILTIN_PACKAGES,
  getPackage,
  isRequire,
  isRequireResolve,
} = require('./utils');

const MODULES_DIR = path.join(__dirname, '..', '..', 'modules');

function isType(kind) {
  return kind === 'type' || kind === 'typeof';
}

module.exports = function(context) {
  const filename = context.getFilename();
  const relativePath = path.relative(MODULES_DIR, filename);
  if (relativePath[0] === '.') {
    return {};
  }

  const dirname = path.dirname(filename);
  const moduleName = relativePath.split(path.sep)[0];
  const moduleDir = path.join(MODULES_DIR, moduleName);
  const modulePkg = getPackage(moduleDir);
  const isSpec =
    filename.indexOf('/spec/') !== -1 ||
    filename.indexOf('/__tests__/') !== -1 ||
    filename.indexOf('/__atom_tests__/') !== -1;
  const allowDevDependencies =
    isSpec || idx(context, _ => _.options[0].allowDevDependencies);

  function checkDependency(node, dep) {
    // Relative imports must be within the root.
    if (dep[0] === '.') {
      const depPath = path.join(dirname, dep);
      if (depPath !== moduleDir && !depPath.startsWith(moduleDir + path.sep)) {
        context.report({
          node,
          message: 'modules/ cannot have external relative dependencies.',
        });
      }
      return;
    }
    // Built-in modules.
    if (ATOM_BUILTIN_PACKAGES.has(dep) || resolveFrom(moduleDir, dep) === dep) {
      return;
    }

    if (dep === 'vscode') {
      if (
        !(modulePkg.engines instanceof Object) ||
        !modulePkg.engines.hasOwnProperty('vscode')
      ) {
        context.report({
          node,
          message:
            'If "vscode" is an import, must declare vscode in "engines." ',
        });
      }
      return;
    }

    const depParts = dep.split('/');
    let depName = depParts[0];
    if (depName.startsWith('@') && depParts.length > 1) {
      depName += '/' + depParts[1];
    }
    if (
      !Object.hasOwnProperty.call(modulePkg.dependencies || {}, depName) &&
      (!allowDevDependencies ||
        !Object.hasOwnProperty.call(
          modulePkg.devDependencies || {},
          depName,
        )) &&
      // We rewrite imports from rxjs to be from rxjs-compat
      !(
        depName === 'rxjs' &&
        Object.hasOwnProperty.call(modulePkg.dependencies || {}, 'rxjs-compat')
      )
    ) {
      context.report({
        node,
        data: {dep: depName, pkg: modulePkg.name},
        message:
          'Dependency "{{dep}}" must be declared in the package.json of module "{{pkg}}".',
      });
    }
  }

  return {
    CallExpression(node) {
      if (!isRequire(node) && !isRequireResolve(node)) {
        return;
      }
      // require("…")
      checkDependency(node, node.arguments[0].value);
    },
    ExportNamedDeclaration(node) {
      if (node.source != null && !isType(node.exportKind)) {
        // export foo from "…"
        checkDependency(node, node.source.value);
      }
    },
    ExportAllDeclaration(node) {
      if (!isType(node.exportKind)) {
        // export * from "…"
        checkDependency(node, node.source.value);
      }
    },
    ImportDeclaration(node) {
      if (!isType(node.importKind)) {
        // import foo from "…"
        checkDependency(node, node.source.value);
      }
    },
  };
};
