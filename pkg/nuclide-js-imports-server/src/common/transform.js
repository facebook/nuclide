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

import type {SourceOptions} from './options/SourceOptions';
import type {ParsingInfo} from './requires/transform';

import jscs from './utils/jscodeshift';

import Options from './options/Options';
import nuclideTransform from './nuclide/transform';
import printRoot from './utils/printRoot';
import requiresTransform from './requires/transform';

export function transform(
  source: string,
  options: SourceOptions,
): {output: string, info: ParsingInfo} {
  Options.validateSourceOptions(options);

  // Parse the source code once, then reuse the root node
  const root = jscs(source);

  // Add use-strict
  // TODO: implement this, make it configurable

  // Requires
  const info = requiresTransform(root, options);

  let output = printRoot(root);

  // Transform that operates on the raw string output.
  output = nuclideTransform(output, options);

  return {output, info};
}

export default transform;
