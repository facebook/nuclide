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

export const HACK_GRAMMARS = ['text.html.hack', 'text.html.php'];

export const HACK_CONFIG_FILE_NAME = '.hhconfig';

// From hack/src/utils/findUtils.ml
export const HACK_FILE_EXTENSIONS: Array<string> = [
  '.php', // normal php file
  '.hh', // Hack extension some open source code is starting to use
  '.phpt', // our php template files
  '.hhi', // interface files only visible to the type checker
  '.xhp', // XHP extensions
];

// Note: this regex is used only by the legacy hack service.
// LSP doesn't use it.
export const HACK_WORD_REGEX = /[a-zA-Z0-9_$]+/g;
