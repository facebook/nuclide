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
import getJSXIdentifiers from './getJSXIdentifiers';

function getUndeclaredJSXIdentifiers(
  root: Collection,
  options: SourceOptions,
): Set<string> {
  const declaredIdentifiers = getDeclaredIdentifiers(root, options);
  const jsxIdentifiers = getJSXIdentifiers(root);
  const undeclared = new Set();
  for (const id of jsxIdentifiers) {
    if (!declaredIdentifiers.has(id)) {
      undeclared.add(id);
    }
  }
  return undeclared;
}

export default getUndeclaredJSXIdentifiers;
