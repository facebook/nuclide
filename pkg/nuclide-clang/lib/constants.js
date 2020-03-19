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

export const CPP_GRAMMARS = ['source.c', 'source.cpp'];
export const OBJC_GRAMMARS = ['source.objc', 'source.objcpp'];

export const GRAMMARS = [...CPP_GRAMMARS, ...OBJC_GRAMMARS];
export const GRAMMAR_SET: Set<string> = new Set(GRAMMARS);

export const PACKAGE_NAME = 'nuclide-clang';

export const IDENTIFIER_REGEXP = /([a-zA-Z_][a-zA-Z0-9_]*)/g;

export const DEFAULT_FLAGS_WARNING =
  'Diagnostics are disabled due to lack of compilation flags. ' +
  'Build this file with Buck, create a compile_commands.json file, then try "Clean and Rebuild".';

export const HEADER_DEFAULT_FLAGS_WARNING =
  'Diagnostics are disabled due to lack of compilation flags. ' +
  'Note that header files only have compilation flags if a source file nearby has the same name or includes it. ' +
  'Include this file from a source file built by Buck, or create a compile_commands.json file, then try "Clean and Rebuild".';
