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

import getRootIdentifierInExpression from './getRootIdentifierInExpression';
import jscs from './jscodeshift';

function isRequireExpression(node: Node): boolean {
  const rootIdentifier = getRootIdentifierInExpression(node);
  return Boolean(
    rootIdentifier &&
      jscs.CallExpression.check(rootIdentifier.parent) &&
      rootIdentifier.name === 'require',
  );
}

export default isRequireExpression;
