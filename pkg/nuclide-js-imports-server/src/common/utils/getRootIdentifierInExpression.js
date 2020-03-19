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

import jscs from './jscodeshift';

const {match} = jscs;

/**
 * This traverses a node to find the first identifier in nested expressions,
 * returning its name and parent node (if applicable).
 */
function getRootIdentifierInExpression(
  node: ?Node,
  parent?: Node,
): ?{name: string, parent: ?Node} {
  if (!node) {
    return null;
  }
  if (match(node, {type: 'ExpressionStatement'})) {
    return getRootIdentifierInExpression(node.expression, node);
  }
  if (match(node, {type: 'CallExpression'})) {
    return getRootIdentifierInExpression(node.callee, node);
  }
  if (match(node, {type: 'MemberExpression'})) {
    return getRootIdentifierInExpression(node.object, node);
  }
  if (match(node, {type: 'Identifier'})) {
    return {name: node.name, parent};
  }
  return null;
}

export default getRootIdentifierInExpression;
