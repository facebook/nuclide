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
import type {SourceOptions} from '../options/SourceOptions';

import getDeclaredIdentifiers from './getDeclaredIdentifiers';
import getDeclaredTypes from './getDeclaredTypes';
import getNonDeclarationTypes from './getNonDeclarationTypes';

/**
 * This will get a list of all types that are used but undeclared.
 */
function getUndeclaredTypes(
  root: Collection,
  options: SourceOptions,
): Set<string> {
  const declaredIdentifiers = getDeclaredIdentifiers(root, options);
  const declaredTypes = getDeclaredTypes(root, options);

  const undeclared = getNonDeclarationTypes(root);
  // now remove anything that was declared
  for (const name of declaredIdentifiers) {
    undeclared.delete(name);
  }
  for (const name of declaredTypes) {
    undeclared.delete(name);
  }
  return undeclared;
}

export default getUndeclaredTypes;
