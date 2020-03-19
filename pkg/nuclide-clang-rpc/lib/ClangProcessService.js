/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {
  ClangCompileResult,
  ClangCompletion,
  ClangCursor,
  ClangDeclaration,
  ClangLocalReferences,
  ClangOutlineTree,
} from './rpc-types';

// This file contains RPC definitions for clang_server.py.

export function compile(contents: string): Promise<ClangCompileResult> {
  throw new Error('Rpc Stub');
}

export function get_completions(
  contents: string,
  line: number,
  column: number,
  tokenStartColumn: number,
  prefix: string,
): Promise<?Array<ClangCompletion>> {
  throw new Error('Rpc Stub');
}

export function get_declaration(
  contents: string,
  line: number,
  column: number,
): Promise<?ClangDeclaration> {
  throw new Error('Rpc Stub');
}

export function get_declaration_info(
  contents: string,
  line: number,
  column: number,
): Promise<?Array<ClangCursor>> {
  throw new Error('Rpc Stub');
}

export function get_outline(
  contents: string,
): Promise<?Array<ClangOutlineTree>> {
  throw new Error('Rpc Stub');
}

export function get_local_references(
  contents: string,
  line: number,
  column: number,
): Promise<?ClangLocalReferences> {
  throw new Error('Rpc Stub');
}
