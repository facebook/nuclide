/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';

export function typeHintFromSnippet(
  snippet: string,
  range: atom$Range,
): TypeHint {
  return {hint: [{type: 'snippet', value: snippet}], range};
}
