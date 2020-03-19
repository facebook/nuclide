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

import jscs from '../utils/jscodeshift';

type ConfigEntry = {
  nodeType: string,
  filters: Array<(path: NodePath) => boolean>,
  getNodes: (path: NodePath) => Array<Node>,
};

const CONFIG: Array<ConfigEntry> = [
  {
    nodeType: jscs.ImportDeclaration,
    filters: [
      path =>
        path.value.importKind === 'type' || path.value.importKind === 'typeof',
    ],
    getNodes: path => path.node.specifiers.map(specifier => specifier.local),
  },
  {
    nodeType: jscs.TypeAlias,
    filters: [],
    getNodes: path => [path.node.id],
  },
  {
    nodeType: jscs.TypeParameterDeclaration,
    filters: [],
    getNodes: path => path.node.params,
  },

  // TODO: remove these, they should be covered by TypeParameterDeclaration
  // but there is a bug in jscodeshift
  {
    nodeType: jscs.ClassDeclaration,
    filters: [
      path =>
        path.node.typeParameters &&
        Array.isArray(path.node.typeParameters.params),
    ],
    getNodes: path => path.node.typeParameters.params,
  },
  {
    nodeType: jscs.DeclareClass,
    filters: [],
    getNodes: path => [path.node.id],
  },
];

/**
 * This will get a list of all flow types that are declared within root's AST
 */
function getDeclaredTypes(
  root: Collection,
  options: SourceOptions,
  filters?: ?Array<(path: NodePath) => boolean>,
): Set<string> {
  // Start with the built in types that are always declared.
  const {moduleMap} = options;
  const ids = new Set(moduleMap.getBuiltInTypes());
  const visitor = {};
  CONFIG.forEach(config => {
    visitor[`visit${config.nodeType}`] = function(path) {
      if (
        (!filters || filters.every(filter => filter(path))) &&
        config.filters.every(filter => filter(path))
      ) {
        const nodes = config.getNodes(path);
        nodes.forEach(node => {
          if (jscs.Identifier.check(node) || jscs.TypeParameter.check(node)) {
            ids.add(node.name);
          }
        });
      }
      this.traverse(path);
    };
  });
  jscs.types.visit(root.nodes()[0], visitor);
  return ids;
}

export default getDeclaredTypes;
