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

import getNamesFromID from './getNamesFromID';
import isValueImport from '../utils/isValueImport';
import jscs from './jscodeshift';

type ConfigEntry = {
  nodeType: string,
  getNodes: (path: NodePath) => Array<Node>,
};

/**
 * These are the ways in which an identifier might be declared, note that these
 * identifiers are safe to use in code. They should not include types that have
 * been declared.
 */
const CONFIG: Array<ConfigEntry> = [
  // import ...rest from ...
  {
    nodeType: jscs.ImportDeclaration,
    getNodes: path =>
      isValueImport(path.node)
        ? path.node.specifiers.map(specifier => specifier.local)
        : [],
  },

  // function foo(...rest) {}
  {
    nodeType: jscs.FunctionDeclaration,
    getNodes: path => [path.node.id, path.node.rest].concat(path.node.params),
  },

  // foo(...rest) {}, in a class body for example
  {
    nodeType: jscs.FunctionExpression,
    getNodes: path => [path.node.rest].concat(path.node.params),
  },

  // class {foo(...rest) {}}, class method
  {
    nodeType: jscs.ClassMethod,
    getNodes: path => path.node.params,
  },

  // x = {foo(...rest) {}}, object method
  {
    nodeType: jscs.ObjectMethod,
    getNodes: path => path.node.params,
  },

  // var foo;
  {
    nodeType: jscs.VariableDeclaration,
    getNodes: path => path.node.declarations.map(declaration => declaration.id),
  },

  // class foo {}
  {
    nodeType: jscs.ClassDeclaration,
    getNodes: path => [path.node.id],
  },

  // (foo, ...rest) => {}
  {
    nodeType: jscs.ArrowFunctionExpression,
    getNodes: path => [path.node.rest].concat(path.node.params),
  },

  // try {} catch (foo) {}
  {
    nodeType: jscs.CatchClause,
    getNodes: path => [path.node.param],
  },

  // function foo(a = b) {}
  {
    nodeType: jscs.AssignmentPattern,
    getNodes: path => [path.node.left],
  },
];

/**
 * This will get a list of all identifiers that are declared within root's AST
 */
function getDeclaredIdentifiers(
  root: Collection,
  options: SourceOptions,
  filters?: ?Array<(path: NodePath) => boolean>,
): Set<string> {
  // Start with the globals since they are always "declared" and safe to use.
  const {moduleMap} = options;
  const ids = new Set(moduleMap.getBuiltIns());
  const visitor = {};
  CONFIG.forEach(config => {
    visitor[`visit${config.nodeType}`] = function(path) {
      if (!filters || filters.every(filter => filter(path))) {
        const nodes = config.getNodes(path);
        nodes.forEach(node => {
          const names = getNamesFromID(node);
          for (const name of names) {
            ids.add(name);
          }
        });
      }
      this.traverse(path);
    };
  });
  jscs.types.visit(root.nodes()[0], visitor);
  return ids;
}

export default getDeclaredIdentifiers;
