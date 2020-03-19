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

import hasOneDeclaration from './hasOneDeclaration';
import isRequireExpression from './isRequireExpression';
import isValueImport from '../utils/isValueImport';
import jscs from 'jscodeshift';

function hasOneRequireDeclarationOrModuleImport(node: Node): boolean {
  if (
    jscs.ImportDeclaration.check(node) &&
    isValueImport(node) &&
    node.specifiers.length > 0
  ) {
    return true;
  }
  if (!hasOneDeclaration(node)) {
    return false;
  }
  const declaration = node.declarations[0];
  return isRequireExpression(declaration.init);
}

export default hasOneRequireDeclarationOrModuleImport;
