/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {Record} from './types';

/**
 * Check to see if the records have changed. This is optimized to take advantage of the knowledge
 * knowledge that record lists are only ever appended.
 */

export default function recordsChanged(
  a: Array<Record>,
  b: Array<Record>,
): boolean {
  return a.length !== b.length || last(a) !== last(b);
}

const last = arr => arr[arr.length - 1];
