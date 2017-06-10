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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

// NOTE that the definitions in this file are shared between
// the ClangService and ClangProcessService.

// TODO: Support enums in rpc3 framework.
// export type ClangCursorType = $Enum<typeof ClangCursorToDeclarationTypes>;
export type ClangCursorType = string;

export type ClangLocation = {
  file: ?NuclideUri,
  point: atom$Point,
};

export type ClangSourceRange = {
  file: ?NuclideUri,
  range: atom$Range,
};

export type ClangCompileResult = {
  diagnostics: Array<{
    spelling: string,
    severity: number,
    location: ClangLocation,
    ranges: ?Array<ClangSourceRange>,
    fixits?: Array<{
      range: ClangSourceRange,
      value: string,
    }>,
    // Diagnostics often have children. This happens for errors like bad function args.
    // Clang emits one diagnostic saying "matching invocation of function f not found"
    // with one or more child diagnostics listing the reasons.
    // (e.g. mismatched types, wrong number of arguments)
    //
    // These technically contain all the fields listed above, but we don't really have a good
    // use for them so they are omitted.
    // In theory, these can also have child diagnostics! Unclear if this ever occurs in practice.
    children?: Array<{
      spelling: string,
      location: ClangLocation,
      ranges: Array<ClangSourceRange>,
    }>,
  }>,
  // If defaultFlags was provided and used, this will be set to true.
  // `diagnostics` is likely to be inaccurate if this was the case.
  accurateFlags?: boolean,
};

export type ClangCompletion = {
  chunks: Array<{
    spelling: string,
    isPlaceHolder?: boolean,
    isOptional?: boolean,
    kind?: string,
  }>,
  result_type: string,
  spelling: string,
  cursor_kind: string,
  brief_comment: ?string,
  // String that Clang intends for us to use for filtering.
  // We do a case-insensitive prefix match against this string.
  typed_name: string,
};

export type ClangDeclaration = {
  file: NuclideUri,
  point: atom$Point,
  spelling: ?string,
  type: ?string,
  extent: atom$Range,
};

export type ClangCursor = {
  name: string,
  type: ClangCursorType,
  cursor_usr: string,
  file: ?NuclideUri,
  extent: atom$Range,
  is_definition: boolean,
};

export type ClangOutlineTree = {
  name: string,
  extent: atom$Range,
  cursor_kind: ClangCursorType,
  // Will be non-null for variables/typedefs only.
  cursor_type?: string,
  // Will be non-null for functions and methods only.
  // Contains a list of the names of parameters.
  params?: Array<string>,
  // List of template parameters (functions/methods only).
  tparams?: Array<string>,
  // Will be non-null for class-like containers only.
  children?: Array<ClangOutlineTree>,
};

export type ClangLocalReferences = {
  cursor_name: string,
  cursor_kind: string,
  references: Array<atom$Range>,
};
