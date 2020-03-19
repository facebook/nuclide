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

/**
 * f.e.: import Foo from 'Foo';
 */
function isValueImport(node: Node): boolean {
  return node.importKind === 'value';
}

export default isValueImport;
