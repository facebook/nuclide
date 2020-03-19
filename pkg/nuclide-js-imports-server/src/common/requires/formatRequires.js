/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {Collection, Node, NodePath} from '../types/ast';
import type {SourceOptions} from '../options/SourceOptions';

import FirstNode from '../utils/FirstNode';
import NewLine from '../utils/NewLine';
import {compareStringsCapitalsFirst, isCapitalized} from '../utils/StringUtils';
import hasOneRequireDeclarationOrModuleImport from '../utils/hasOneRequireDeclarationOrModuleImport';
import isGlobal from '../utils/isGlobal';
import isRequireExpression from '../utils/isRequireExpression';
import isTypeImport from '../utils/isTypeImport';
import isTypeofImport from '../utils/isTypeofImport';
import jscs from '../utils/jscodeshift';
import reprintRequire from '../utils/reprintRequire';

type ConfigEntry = {
  nodeType: string,
  filters: Array<(path: NodePath, options: SourceOptions) => boolean>,
  getSource: (node: Node, options: SourceOptions) => string,
};

// Set up a config to easily add require formats
const CONFIG: Array<ConfigEntry> = [
  // Handle type imports
  {
    nodeType: jscs.ImportDeclaration,
    filters: [isGlobal, path => isTypeImport(path) || isTypeofImport(path)],
    getSource: node => node.source.value,
  },

  // Handle side effectful requires, e.g: `require('monkey-patches');`
  {
    nodeType: jscs.ExpressionStatement,
    filters: [isGlobal, path => isRequireExpression(path.node)],
    getSource: node => getModuleName(node.expression),
  },

  // Handle side effectful imports, e.g: `import 'monkey-patches';`
  {
    nodeType: jscs.ImportDeclaration,
    filters: [path => isBareImport(path.node)],
    getSource: node => getModuleName(node),
  },

  // Handle UpperCase requires, e.g: `const UpperCase = require('UpperCase');`
  {
    nodeType: jscs.VariableDeclaration,
    filters: [
      isGlobal,
      path => isValidRequireDeclaration(path.node),
      (path, options) => isCapitalizedRequireName(path.node, options),
    ],
    getSource: (node, options) => normalizedRequireSource(node, options),
  },

  // Handle UpperCase imports, e.g: `import UpperCase from 'UpperCase';`
  {
    nodeType: jscs.ImportDeclaration,
    filters: [(path, options) => isCapitalizedImportName(path.node, options)],
    getSource: (node, options) =>
      normalizeModuleName(getModuleName(node), options),
  },

  // Handle lowerCase requires, e.g: `const lowerCase = require('lowerCase');`
  {
    nodeType: jscs.VariableDeclaration,
    filters: [
      isGlobal,
      path => isValidRequireDeclaration(path.node),
      (path, options) => !isCapitalizedRequireName(path.node, options),
    ],
    getSource: (node, options) => normalizedRequireSource(node, options),
  },

  // Handle lowerCase imports, e.g: `import lowerCase from 'lowerCase';`
  {
    nodeType: jscs.ImportDeclaration,
    filters: [(path, options) => !isCapitalizedImportName(path.node, options)],
    getSource: (node, options) =>
      normalizeModuleName(getModuleName(node), options),
  },
];

/**
 * This formats requires based on the right hand side of the require.
 *
 * The groups are:
 *
 *   - import types: import type Foo from 'anything';
 *   - require expressions: require('anything');
 *   - capitalized requires: var Foo = require('Anything');
 *   - non-capitalized requires: var foo = require('anything');
 *
 * Array and object destructures are also valid left hand sides. Object patterns
 * are sorted.
 */
function formatRequires(root: Collection, options: SourceOptions): void {
  const first = FirstNode.get(root);
  if (!first) {
    return;
  }
  const _first = first; // For flow.
  // Create groups of requires from each config
  const nodeGroups = CONFIG.map(config => {
    const paths = root
      .find(config.nodeType)
      .filter(path => config.filters.every(filter => filter(path, options)));

    // Save the underlying nodes before removing the paths
    const nodes = paths.nodes().slice();
    paths.forEach(path => jscs(path).remove());
    const sourceGroups = {};
    nodes.forEach(node => {
      const source = config.getSource(node, options);
      (sourceGroups[source] = sourceGroups[source] || []).push(node);
    });
    return Object.keys(sourceGroups)
      .sort((source1, source2) => compareStringsCapitalsFirst(source1, source2))
      .map(source => reprintRequire(sourceGroups[source]));
  });

  const programBody = root.get('program').get('body');
  const allNodesRemoved = programBody.value.length === 0;

  // Build all the nodes we want to insert, then add them
  const allGroups = [[NewLine.statement]];
  nodeGroups.forEach(group => allGroups.push(group, [NewLine.statement]));
  const nodesToInsert = [].concat(...allGroups);
  if (allNodesRemoved) {
    programBody.push(...nodesToInsert);
  } else {
    _first.insertBefore(...nodesToInsert);
  }
}

/**
 * Tests if a variable declaration is a valid require declaration.
 */
function isValidRequireDeclaration(node: Node): boolean {
  if (!hasOneRequireDeclarationOrModuleImport(node)) {
    return false;
  }
  const declaration = node.declarations[0];
  if (jscs.Identifier.check(declaration.id)) {
    return true;
  }
  if (jscs.ObjectPattern.check(declaration.id)) {
    return declaration.id.properties.every(prop =>
      jscs.Identifier.check(prop.key),
    );
  }
  if (jscs.ArrayPattern.check(declaration.id)) {
    return declaration.id.elements.every(element =>
      jscs.Identifier.check(element),
    );
  }
  return false;
}

function isCapitalizedRequireName(node: Node, options: SourceOptions): boolean {
  return isCapitalized(getModuleName(node.declarations[0].init));
}

function isCapitalizedImportName(node: Node, options: SourceOptions): boolean {
  return isCapitalized(normalizeModuleName(getModuleName(node), options));
}

function normalizedRequireSource(node: Node, options: SourceOptions): string {
  return normalizeModuleName(
    tagPatternRequire(getModuleName(node.declarations[0].init), node),
    options,
  );
}

function getModuleName(requireNode: Node): string {
  let rhs = requireNode;
  const names = [];
  while (true) {
    if (jscs.ImportDeclaration.check(rhs)) {
      return rhs.source.value;
    } else if (jscs.MemberExpression.check(rhs)) {
      names.unshift(rhs.property.name);
      rhs = rhs.object;
    } else if (
      jscs.CallExpression.check(rhs) &&
      !jscs.Identifier.check(rhs.callee)
    ) {
      rhs = rhs.callee;
    } else if (jscs.ExpressionStatement.check(rhs)) {
      rhs = rhs.expression;
    } else {
      break;
    }
  }
  names.unshift(rhs.arguments[0].value);
  return names.join('.');
}

function normalizeModuleName(name: string, options: SourceOptions): string {
  return options.moduleMap.getAlias(name);
}

// Tag pattern requires so they are not mangled by normal id requires,
// and to make the ordering deterministic
function tagPatternRequire(name: string, node: Node): string {
  const tag = jscs.Identifier.check(node.declarations[0].id) ? '' : '|PATTERN';
  return name + tag;
}

function isBareImport(importNode: Node): boolean {
  return importNode.specifiers.length === 0;
}

export default formatRequires;
