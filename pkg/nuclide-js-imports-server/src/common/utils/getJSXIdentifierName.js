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

import type {Node, NodePath} from '../types/ast';

import jscs from './jscodeshift';
import {isLowerCase} from './StringUtils';

// TODO: make this configurable somehow, we probably don't want to explicitly
// list out all of the lowercase html tags that are built-in
const LOWER_CASE_WHITE_LIST = new Set(['fbt']);

/**
 * Returns an array of nodes for convenience.
 */
function getJSXIdentifierName(path: NodePath): Array<Node> {
  if (jscs.JSXIdentifier.check(path.node.name)) {
    const name = path.node.name.name;
    // TODO: should this be here or in addMissingRequires?
    if (!isLowerCase(name) || LOWER_CASE_WHITE_LIST.has(name)) {
      return [path.node.name];
    }
  }
  return [];
}

export default getJSXIdentifierName;
