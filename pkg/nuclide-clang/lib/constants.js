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

export const GRAMMARS = [
  'source.c',
  'source.cpp',
  'source.objc',
  'source.objcpp',
];
export const GRAMMAR_SET: Set<string> = new Set(GRAMMARS);

export const PACKAGE_NAME = 'nuclide-clang';

export const IDENTIFIER_REGEXP = /([a-zA-Z_][a-zA-Z0-9_]*)/g;

export const DEFAULT_FLAGS_WARNING =
  'Diagnostics are disabled due to lack of compilation flags. ' +
  'Build this file with Buck, create a compile_commands.json file, or try "Clean and Rebuild".';
