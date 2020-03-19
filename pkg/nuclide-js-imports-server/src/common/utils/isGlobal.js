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

import type {NodePath} from '../types/ast';

/**
 * Tests if a NodePath is a direct child of the Program node.
 */
function isGlobal(path: NodePath): boolean {
  return path.parent && path.parent.node.type === 'Program';
}

export default isGlobal;
