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

import fuzzldrin from 'fuzzaldrin-plus';

const noSpaceNeededPrefixes = new Set(' !@#$%^&*();[]-_?/\'".,<>{}:');
noSpaceNeededPrefixes.add(''); // empty prefix (omnisearch) also doesn't require a space

export function prefixRequiresSpace(prefix: string): boolean {
  return prefix.length > 1 || !noSpaceNeededPrefixes.has(prefix);
}

export function fuzzyRelevance(string: string, query: string) {
  return fuzzldrin.score(string, query) / fuzzldrin.score(string, string);
}
