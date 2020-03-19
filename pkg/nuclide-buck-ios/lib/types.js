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

export const RUNNABLE_RULE_TYPES: Set<string> = new Set(['apple_bundle']);
export const SUPPORTED_RULE_TYPES: Set<string> = new Set([
  ...RUNNABLE_RULE_TYPES,
  'apple_library',
  'apple_test',
]);
