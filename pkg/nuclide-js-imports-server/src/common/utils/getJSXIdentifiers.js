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

import type {Collection} from '../types/ast';

import getJSXIdentifierName from './getJSXIdentifierName';
import jscs from './jscodeshift';

/**
 * This will get a list of identifiers for JSXElements in the AST
 */
function getJSXIdentifiers(root: Collection): Set<string> {
  const ids = new Set();
  root
    // There should be an opening element for every single closing element so
    // we can just look for opening ones
    .find(jscs.JSXOpeningElement)
    .forEach(path => {
      getJSXIdentifierName(path).forEach(node => {
        ids.add(node.name);
      });
    });
  return ids;
}

export default getJSXIdentifiers;
