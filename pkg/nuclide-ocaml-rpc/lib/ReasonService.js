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

import {formatImpl} from './ReasonProcess';

export type formatResult =
  | {type: 'result', formattedResult: string}
  | {type: 'error', error: string};

export async function format(
  content: string,
  language: 're' | 'ml',
  refmtFlags: Array<string>,
): Promise<formatResult> {
  return formatImpl(content, language, refmtFlags);
}
