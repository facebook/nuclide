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

import getDeclaredIdentifiers from '../utils/getDeclaredIdentifiers';
import getDeclaredTypes from '../utils/getDeclaredTypes';
import getNonDeclarationTypes from '../utils/getNonDeclarationTypes';
import isGlobal from '../utils/isGlobal';
import isTypeImport from '../utils/isTypeImport';
import jscs from '../utils/jscodeshift';

const {match} = jscs;

type ConfigEntry = {
  nodeType: string,
  filters: Array<(path: NodePath) => boolean>,
  getNames: (node: Node) => Array<string>,
};

// These are the things we should try to remove.
const CONFIG: Array<ConfigEntry> = [
  // import type Foo from 'Foo';
  {
    nodeType: jscs.ImportDeclaration,
    filters: [isGlobal, isTypeImport],
    getNames: node => node.specifiers.map(specifier => specifier.local.name),
  },
  {
    nodeType: jscs.ImportSpecifier,
    filters: [path => isGlobal(path.parent) && isTypeImport(path.parent)],
    getNames: node => [node.local.name],
  },
];

function removeUnusedTypes(root: Collection, options: SourceOptions): void {
  const declared = getDeclaredIdentifiers(root, options);
  const used = getNonDeclarationTypes(root);
  const nonTypeImport = getDeclaredTypes(root, options, [
    path => !isTypeImportDeclaration(path.node),
  ]);
  // Remove things based on the config.
  CONFIG.forEach(config => {
    root
      .find(config.nodeType)
      .filter(path => config.filters.every(filter => filter(path)))
      .filter(path =>
        config
          .getNames(path.node)
          .every(
            name =>
              !used.has(name) || declared.has(name) || nonTypeImport.has(name),
          ),
      )
      .remove();
  });
}

function isTypeImportDeclaration(node: NodePath): boolean {
  return match(node, {
    type: 'ImportDeclaration',
    importKind: 'type',
  });
}

export default removeUnusedTypes;
