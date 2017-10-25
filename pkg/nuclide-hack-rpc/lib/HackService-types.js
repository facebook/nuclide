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
import type {FileVersion} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  DefinitionQueryResult,
  FindReferencesReturn,
  Outline,
} from 'atom-ide-ui';
import type {ConnectableObservable} from 'rxjs';
import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';
import type {
  AutocompleteRequest,
  AutocompleteResult,
  FileDiagnosticMap,
  SymbolResult,
  LanguageService,
} from '../../nuclide-language-service/lib/LanguageService';

// TODO: Remove this once interface inheritance/subtyping is implemented in nuclide-rpc.
export interface HackLanguageService extends LanguageService {
  getDiagnostics(fileVersion: FileVersion): Promise<?FileDiagnosticMap>,

  observeDiagnostics(): ConnectableObservable<FileDiagnosticMap>,

  getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    request: AutocompleteRequest,
  ): Promise<?AutocompleteResult>,

  getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult>,

  findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?FindReferencesReturn>,

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult>,

  getOutline(fileVersion: FileVersion): Promise<?Outline>,

  typeHint(fileVersion: FileVersion, position: atom$Point): Promise<?TypeHint>,

  highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>>,

  formatSource(
    fileVersion: FileVersion,
    range: atom$Range,
  ): Promise<?Array<TextEdit>>,

  formatEntireFile(
    fileVersion: FileVersion,
    range: atom$Range,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }>,

  getEvaluationExpression(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression>,

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri>,

  isFileInProject(fileUri: NuclideUri): Promise<boolean>,

  supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean>,

  symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>>,

  dispose(): void,
}
