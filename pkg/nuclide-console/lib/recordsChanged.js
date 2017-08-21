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

import type {DisplayableRecord} from './types';

import idx from 'idx';

/**
 * Check to see if the records have changed. This is optimized to take advantage of the knowledge
 * knowledge that record lists are only ever appended.
 */
export default function recordsChanged(
  a: Array<DisplayableRecord>,
  b: Array<DisplayableRecord>,
): boolean {
  return (
    a.length !== b.length || idx(last(a), _ => _.id) !== idx(last(b), _ => _.id)
  );
}

const last = arr => arr[arr.length - 1];
