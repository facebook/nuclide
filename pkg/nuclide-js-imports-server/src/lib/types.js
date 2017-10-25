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

type ExportType =
  | 'FunctionDeclaration'
  | 'ClassDeclaration'
  | 'VariableDeclaration'
  | 'InterfaceDeclaration'
  | 'ObjectExpression'
  | 'FunctionExpression'
  | 'ClassExpression'
  | 'TypeAlias'
  | 'NumericLiteral'
  | 'StringLiteral';

export type ImportSuggestion = {
  symbol: UndefinedSymbol,
  filesWithExport: Array<JSExport>,
};

export type JSImport = {
  type: 'require' | 'import' | 'importType',
  importPath: string,
};

export type JSExport = {
  id: string,
  uri: NuclideUri,
  isTypeExport: boolean,
  isDefault: boolean,
  hasteName?: string,
  directoryForMainFile?: NuclideUri,
  type?: ExportType,
};

export type UndefinedSymbol = {
  id: string,
  type: 'value' | 'type',
  location: Location,
};

type Location = {
  start: {col: number, line: number},
  end: {col: number, line: number},
};

export type BabylonOptions = {
  allowImportExportEverywhere?: boolean,
  allowReturnOutsideFunction?: boolean,
  sourceType?: 'module' | 'script',
  startLine?: number,
  plugins: Array<string>,
};
