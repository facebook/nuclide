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

/**
 * This is a hack to force an ObjectPattern node to be printed on one line
 */
function oneLineObjectPattern(node: Node): Node {
  if (!jscs.ObjectPattern.check(node)) {
    return node;
  }

  const props = node.properties;
  if (!props.every(prop => prop.shorthand && jscs.Identifier.check(prop.key))) {
    return node;
  }

  const mySource =
    'var {' + props.map(prop => prop.key.name).join(', ') + '} = _;';
  const myAst = jscs(mySource);
  return myAst.find(jscs.ObjectPattern).nodes()[0];
}

export default oneLineObjectPattern;
