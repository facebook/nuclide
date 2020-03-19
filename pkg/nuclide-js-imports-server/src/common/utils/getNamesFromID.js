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

function getNamesFromID(node: Node): Set<string> {
  const ids = new Set();
  if (jscs.Identifier.check(node) || jscs.JSXIdentifier.check(node)) {
    ids.add(node.name);
  } else if (
    jscs.RestElement.check(node) ||
    jscs.SpreadElement.check(node) ||
    jscs.SpreadProperty.check(node) ||
    jscs.RestProperty.check(node)
  ) {
    for (const id of getNamesFromID(node.argument)) {
      ids.add(id);
    }
  } else if (jscs.ObjectPattern.check(node)) {
    node.properties.forEach(prop => {
      // Generally props have a value, if it is a spread property it doesn't.
      for (const id of getNamesFromID(prop.value || prop)) {
        ids.add(id);
      }
    });
  } else if (jscs.ArrayPattern.check(node)) {
    node.elements.forEach(element => {
      for (const id of getNamesFromID(element)) {
        ids.add(id);
      }
    });
  }
  return ids;
}

export default getNamesFromID;
