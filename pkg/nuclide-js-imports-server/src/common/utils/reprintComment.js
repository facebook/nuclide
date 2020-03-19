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

function reprintComment(node: Node): Node {
  if (node.type === 'Block') {
    return jscs.block(node.value);
  } else if (node.type === 'Line') {
    return jscs.line(node.value);
  }
  return node;
}

export default reprintComment;
