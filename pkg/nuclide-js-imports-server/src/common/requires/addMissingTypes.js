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

import FirstNode from '../utils/FirstNode';
import getUndeclaredTypes from '../utils/getUndeclaredTypes';

function addMissingTypes(root: Collection, options: SourceOptions): boolean {
  const first = FirstNode.get(root);
  if (!first) {
    return false;
  }
  const _first = first; // For flow.

  const {moduleMap} = options;
  const requireOptions = {
    sourcePath: options.sourcePath,
    typeImport: true,
  };

  const undeclaredTypes = getUndeclaredTypes(root, options);
  if (!options.dontAddMissing) {
    undeclaredTypes.forEach(name => {
      const node = moduleMap.getRequire(name, requireOptions);
      _first.insertBefore(node);
    });
  }
  return undeclaredTypes.size > 0;
}

export default addMissingTypes;
