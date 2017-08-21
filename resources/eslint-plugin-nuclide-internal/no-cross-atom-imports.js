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

const {ATOM_BUILTIN_PACKAGES, getPackage, isRequire} = require('./utils');

const ATOM_IDE_PACKAGES = new Set([
  'atom-ide-ui',
  'nuclide-commons-atom',
  'nuclide-commons-ui',
]);

module.exports = function(context) {
  const filename = context.getFilename();
  const dirname = path.dirname(filename);
  const ownPackage = getPackage(filename);

  const whitelist =
    new Set(context.options[0] && context.options[0].whitelist || []);

  if (!ownPackage) {
    throw new Error(`"${filename}" does not have a package.json`);
  }

  // Packages come in 3 flavors:
  // packageType: Atom & testRunner: apm
  // packageType: Node & testRunner: apm
  // packageType: Node & testRunner: npm
  const isPureNode = ownPackage.nuclide && ownPackage.nuclide.testRunner === 'npm';

  function getCrossImportPackage(id) {
    // npm packages can't require Atom builtins.
    if (ATOM_BUILTIN_PACKAGES.has(id)) {
      if (isPureNode) {
        return {type: 'NO_NPM_TO_ATOM_BUILTIN', name: id};
      } else {
        return null;
      }
    }

    if (ATOM_IDE_PACKAGES.has(id)) {
      if (isPureNode) {
        return {type: 'NO_NPM_TO_ATOM_UI_PACKAGES', name: id};
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
    // Requiring anything within our own package is ok.
    if (resolvedPackage.__dirname === ownPackage.__dirname) {
      return null;
    }
    // An apm package requiring a whitelisted package is ok.
    if (ownPackage.nuclide &&
        ownPackage.nuclide.testRunner === 'apm' &&
        whitelist.has(resolvedPackage.name)) {
      return null;
    }
    // Nothing can require into an Atom package
    if (resolvedPackage.nuclide &&
        resolvedPackage.nuclide.packageType === 'Atom') {
      return {type: 'NO_ATOM', name: resolvedPackage.name};
    }
    // npm packages can only require other npm packages.
    if (ownPackage.nuclide &&
        ownPackage.nuclide.testRunner === 'npm' &&
        resolvedPackage.nuclide &&
        resolvedPackage.nuclide.testRunner === 'apm') {
      return {type: 'NO_NPM_TO_APM', name: resolvedPackage.name};
    }

    return null;
  }

  function reportError(node, action, result) {
    const message =
      result.type === 'NO_ATOM'
        ? 'Atom package "{{name}}" is not {{action}} from other packages.' :
      result.type === 'NO_NPM_TO_APM'
        ? 'apm package "{{name}}" is not {{action}} from an npm package.' :
      result.type === 'NO_NPM_TO_ATOM_BUILTIN'
        ? 'Atom builtin package "{{name}}" is not {{action}} from an npm package.' :
      result.type === 'NO_NPM_TO_ATOM_UI_PACKAGES'
        ? 'Nuclide/Atom UI package "{{name}}" is not {{action}} from an npm package.' :
      null;
    context.report({
      node,
      data: {name: result.name, action},
      message,
    });
  }

  return {
    CallExpression(node) {
      if (!isRequire(node)) {
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
