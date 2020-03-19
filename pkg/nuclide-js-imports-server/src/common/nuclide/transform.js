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

import type {SourceOptions} from '../options/SourceOptions';
import type {TransformKey} from '../types/transforms';

function transform(source: string, options: SourceOptions): string {
  const blacklist: Set<TransformKey> = options.blacklist || new Set();
  if (blacklist.has('nuclide.fixHeader')) {
    return source;
  }
  return source.replace(
    "'use babel';\n\n/* @flow */",
    "'use babel';\n/* @flow */",
  );
}

export default transform;
