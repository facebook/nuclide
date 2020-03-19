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

export type CodeSearchTool = 'rg' | 'ack' | 'grep';

type CodeSearchParamsBase = {
  regex: RegExp,
  limit?: number,
  leadingLines?: ?number,
  trailingLines?: ?number,
};

export type DirectoryCodeSearchParams = CodeSearchParamsBase & {
  recursive: true,
  directory: string,
};

export type FileCodeSearchParams = CodeSearchParamsBase & {
  recursive: false,
  files: Array<string>,
};

export type CodeSearchParams = DirectoryCodeSearchParams | FileCodeSearchParams;

// Note: rows and columns are 0-based.
export type CodeSearchResult = {
  file: NuclideUri,
  row: number,
  column: number,
  line: string,
  matchLength: number,
  leadingContext: Array<string>,
  trailingContext: Array<string>,
};

export type search$Match = {
  lineText: string,
  lineTextOffset: number,
  matchText: string,
  range: Array<Array<number>>,
  leadingContextLines: Array<string>,
  trailingContextLines: Array<string>,
};

export type search$FileResult = {
  filePath: NuclideUri,
  matches: Array<search$Match>,
};
