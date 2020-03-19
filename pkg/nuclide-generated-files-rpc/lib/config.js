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

let generatedTag: ?string;
let partialGeneratedTag: ?string;
let generatedPathRegexes: Array<RegExp>;
try {
  ({
    generatedTag,
    partialGeneratedTag,
    generatedPathRegexes,
    // $FlowFB
  } = require('./fb/config'));
} catch (e) {
  // fill in local configuration properties here
  generatedPathRegexes = [];
}

export const config: GeneratedFilesConfig = {
  generatedTag,
  partialGeneratedTag,
  generatedPathRegexes,
};

export type GeneratedFilesConfig = typeof config;
