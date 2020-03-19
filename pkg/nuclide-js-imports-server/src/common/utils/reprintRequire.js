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

import type {Node} from '../types/ast';

import {
  compareStringsCapitalsLast,
  compareStringsCapitalsFirst,
} from './StringUtils';
import jscs from './jscodeshift';
import oneLineObjectPattern from './oneLineObjectPattern';
import reprintComment from './reprintComment';

const {statement} = jscs.template;

/**
 * Thin wrapper to reprint requires, it's wrapped in a new function in order to
 * easily attach comments to the node.
 */
function reprintRequire(nodes: Array<Node>): Node {
  let comments = null;
  nodes.forEach(node => {
    comments = comments || node.comments;
  });
  const newNode = reprintRequireHelper(nodes);
  if (comments) {
    newNode.comments = comments.map(comment => reprintComment(comment));
  }
  return newNode;
}

/**
 * This takes in require/import nodes with the same source and reprints them
 * as a single require/import. This should remove whitespace
 * and allow us to have a consistent formatting of all requires.
 */
function reprintRequireHelper(nodes: Array<Node>): Node {
  const node = nodes[0];
  const otherNodes = nodes.slice(1);
  if (jscs.ExpressionStatement.check(node)) {
    return statement`${node.expression}`;
  }

  if (jscs.VariableDeclaration.check(node)) {
    const kind = node.kind || 'const';
    const declaration = node.declarations[0];
    if (jscs.Identifier.check(declaration.id)) {
      return jscs.variableDeclaration(kind, [
        jscs.variableDeclarator(declaration.id, declaration.init),
      ]);
    } else if (jscs.ObjectPattern.check(declaration.id)) {
      otherNodes.forEach(otherNode => {
        const otherDeclaration = otherNode.declarations[0];
        declaration.id.properties.push(...otherDeclaration.id.properties);
      });
      removeDuplicatesInPlace(declaration.id.properties, one => one.value.name);
      declaration.id.properties.sort((prop1, prop2) => {
        return compareStringsCapitalsFirst(prop1.value.name, prop2.value.name);
      });
      return jscs.variableDeclaration(kind, [
        jscs.variableDeclarator(
          oneLineObjectPattern(declaration.id),
          declaration.init,
        ),
      ]);
    } else if (jscs.ArrayPattern.check(declaration.id)) {
      let bestList = declaration.id;
      otherNodes.forEach(otherNode => {
        const otherList = otherNode.declarations[0].id;
        const otherListSize = otherList.elements && otherList.elements.length;
        // TODO: support simultaneous object and array destructuring
        if (otherListSize > bestList.elements.length) {
          bestList = otherList;
        }
      });
      return jscs.variableDeclaration(kind, [
        jscs.variableDeclarator(bestList, declaration.init),
      ]);
    }
  }

  if (jscs.ImportDeclaration.check(node)) {
    otherNodes.forEach(otherNode => {
      const otherSpecifiers = otherNode.specifiers.filter(
        specifier => specifier.imported != null,
      );
      node.specifiers.push(...otherSpecifiers);
    });

    removeDuplicatesInPlace(
      node.specifiers,
      one => one.local && one.local.name,
    );

    // Sort the specifiers.
    node.specifiers.sort((one, two) => {
      // Default specifier goes first
      if (jscs.ImportDefaultSpecifier.check(one)) {
        return -1;
      }
      if (jscs.ImportDefaultSpecifier.check(two)) {
        return 1;
      }
      return compareStringsCapitalsLast(one.local.name, two.local.name);
    });
    return node;
  }

  return node;
}

function removeDuplicatesInPlace<T1, T2>(list: Array<T1>, getter: T1 => T2) {
  const map: {[key: T2]: boolean} = {};
  for (let i = list.length - 1; i >= 0; i--) {
    const label = getter(list[i]);
    if (label != null && map[label]) {
      list.splice(i, 1);
    }
    map[label] = true;
  }
}

export default reprintRequire;
