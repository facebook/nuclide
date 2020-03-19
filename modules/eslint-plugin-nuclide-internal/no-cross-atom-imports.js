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

const {
  ATOM_BUILTIN_PACKAGES,
  getPackage,
  isRequire,
  isRequireResolve,
} = require('./utils');

const ATOM_IDE_PACKAGES = new Set([
  'atom-ide-ui',
  'nuclide-commons-atom',
  'nuclide-commons-ui',
]);

module.exports = function(context) {
  const filename = context.getFilename();
  const dirname = path.dirname(filename);
  const ownPackage = getPackage(filename);

  const whitelist = new Set(
    (context.options[0] && context.options[0].whitelist) || [],
  );

  if (!ownPackage) {
    throw new Error(`"${filename}" does not have a package.json`);
  }

  // Packages come in 3 flavors:
  const ATOM_PACKAGE = 'AtomPackage';
  const ATOM_LIBRARY = 'AtomLibrary';
  const NODE_LIBRARY = 'NodeLibrary';

  const ownPackageType = ownPackage.nuclide && ownPackage.nuclide.packageType;

  function getCrossImportPackage(id) {
    // Node libraries packages can't require Atom builtins.
    if (ATOM_BUILTIN_PACKAGES.has(id)) {
      if (ownPackageType === NODE_LIBRARY) {
        return {type: 'NO_NODE_TO_ATOM_BUILTIN', name: id};
      } else {
        return null;
      }
    }

    if (ATOM_IDE_PACKAGES.has(id)) {
      if (ownPackageType === NODE_LIBRARY) {
        return {type: 'NO_NODE_TO_ATOM_UI_PACKAGES', name: id};
      } else {
        return null;
      }
    }

    const resolved = resolveFrom(dirname, id);
    // Exclude modules that are not found, builtins, or not ours.
    if (
      resolved == null ||
      resolved === id ||
      resolved.includes('/node_modules/')
    ) {
      return null;
    }
    const resolvedPackage = getPackage(resolved);

    const resolvedPackageType =
      resolvedPackage.nuclide && resolvedPackage.nuclide.packageType;
    // Requiring anything within our own package is ok.
    if (resolvedPackage.__dirname === ownPackage.__dirname) {
      return null;
    }
    // An Atom package/library requiring a whitelisted package is ok.
    if (
      [ATOM_LIBRARY, ATOM_PACKAGE].includes(ownPackageType) &&
      whitelist.has(resolvedPackage.name)
    ) {
      return null;
    }
    // Nothing can require into an Atom package
    if (resolvedPackageType === ATOM_PACKAGE) {
      return {type: 'NO_ATOM', name: resolvedPackage.name};
    }
    // Node packages can only require other npm packages.
    if (
      ownPackageType === NODE_LIBRARY &&
      (resolvedPackageType === ATOM_LIBRARY ||
        resolvedPackageType === ATOM_PACKAGE)
    ) {
      return {type: 'NO_NODE_TO_ATOM', name: resolvedPackage.name};
    }

    return null;
  }

  function reportError(node, action, result) {
    const message =
      result.type === 'NO_ATOM'
        ? 'Atom package "{{name}}" is not {{action}} from other packages.'
        : result.type === 'NO_NODE_TO_ATOM'
          ? 'Atom package "{{name}}" is not {{action}} from a Node library.'
          : result.type === 'NO_NODE_TO_ATOM_BUILTIN'
            ? 'Atom builtin package "{{name}}" is not {{action}} from a Node library.'
            : result.type === 'NO_NODE_TO_ATOM_UI_PACKAGES'
              ? 'Nuclide/Atom UI package "{{name}}" is not {{action}} from a Node library.'
              : null;
    context.report({
      node,
      data: {name: result.name, action},
      message,
    });
  }

  return {
    CallExpression(node) {
      if (!isRequire(node) && !isRequireResolve(node)) {
        return;
      }
      // require("…")
      const id = node.arguments[0].value;
      const result = getCrossImportPackage(id);
      if (result) {
        reportError(node, 'requireable', result);
      }
    },
    ExportNamedDeclaration(node) {
      if (node.source == null || node.exportKind === 'type') {
        return;
      }
      // export foo from "…"
      const id = node.source.value;
      const result = getCrossImportPackage(id);
      if (result) {
        reportError(node, 'exportable', result);
      }
    },
    ExportAllDeclaration(node) {
      // export * from "…"
      const id = node.source.value;
      const result = getCrossImportPackage(id);
      if (result) {
        reportError(node, 'exportable', result);
      }
    },
    ImportDeclaration(node) {
      if (node.importKind === 'type' || node.importKind === 'typeof') {
        return;
      }
      // import foo from "…"
      const id = node.source.value;
      const result = getCrossImportPackage(id);
      if (result) {
        reportError(node, 'importable', result);
      }
    },
  };
};
