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
 * f.e.: import typeof Foo from 'Foo';
 */
function isTypeofImport(path: NodePath): boolean {
  return path.value.importKind === 'typeof';
}

export default isTypeofImport;
