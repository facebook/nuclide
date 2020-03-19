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

import type {Collection, NodePath} from '../types/ast';

import NewLine from './NewLine';
import getRootIdentifierInExpression from './getRootIdentifierInExpression';
import isGlobal from './isGlobal';
import jscs from './jscodeshift';

const {match} = jscs;

const FirstNode = {
  /**
   * Gets the first node that it's safe to insert before on.
   *
   * Note: We never need to add a first node. If a first node doesn't exist
   * then there isn't ever code that would result in a require being changed.
   */
  get(root: Collection): ?NodePath {
    let first;
    jscs.types.visit(root.nodes()[0], {
      visitNode(path) {
        if (isGlobal(path) && isValidFirstNode(path)) {
          if (!first) {
            first = path;
          }
          return false; // stop iterating the AST
        }
        this.traverse(path);
      },
    });
    return first;
  },
};

function isValidFirstNode(path: NodePath): boolean {
  // A new line literal is okay.
  if (match(path, {expression: {value: NewLine.literal}})) {
    return true;
  }
  // Any other literal is not.
  if (match(path, {expression: {type: 'Literal'}})) {
    return false;
  }
  const rootIdentifier = getRootIdentifierInExpression(path.node);
  if (
    rootIdentifier &&
    (rootIdentifier.name === 'jest' ||
      (rootIdentifier.name === 'require' &&
        jscs.MemberExpression.check(rootIdentifier.parent)))
  ) {
    return false;
  }
  return true;
}

export default FirstNode;
