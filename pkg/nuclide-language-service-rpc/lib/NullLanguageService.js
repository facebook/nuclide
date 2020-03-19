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
import type {DeadlineRequest} from 'nuclide-commons/promise';
import type {AdditionalLogFile} from '../../nuclide-logging/lib/rpc-types';
import type {FileVersion} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  DefinitionQueryResult,
  FindReferencesReturn,
  RenameReturn,
  Outline,
  CodeAction,
  SignatureHelp,
} from 'atom-ide-ui';
import type {ConnectableObservable} from 'rxjs';
import type {
  AutocompleteRequest,
  AutocompleteResult,
  FileDiagnosticMap,
  FileDiagnosticMessage,
  FormatOptions,
  LanguageService,
  SymbolResult,
  Completion,
  CodeLensData,
  StatusData,
} from '../../nuclide-language-service/lib/LanguageService';

import {Observable} from 'rxjs';

// An implementation of LanguageService which always returns no results.
// Useful for implementing aggregate language services.
export class NullLanguageService {
  getDiagnostics(fileVersion: FileVersion): Promise<?FileDiagnosticMap> {
    return Promise.resolve(null);
  }

  observeDiagnostics(): ConnectableObservable<FileDiagnosticMap> {
    return Observable.empty().publish();
  }

  getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    request: AutocompleteRequest,
  ): Promise<?AutocompleteResult> {
    return Promise.resolve(null);
  }

  resolveAutocompleteSuggestion(suggestion: Completion): Promise<?Completion> {
    return Promise.resolve(null);
  }

  getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return Promise.resolve(null);
  }

  onToggleCoverage(set: boolean): Promise<void> {
    return Promise.resolve(undefined);
  }

  findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): ConnectableObservable<?FindReferencesReturn> {
    return Observable.of(null).publish();
  }

  rename(
    fileVersion: FileVersion,
    position: atom$Point,
    newName: string,
  ): ConnectableObservable<?RenameReturn> {
    return Observable.of(null).publish();
  }

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    return Promise.resolve(null);
  }

  getOutline(fileVersion: FileVersion): Promise<?Outline> {
    return Promise.resolve(null);
  }

  getCodeLens(fileVersion: FileVersion): Promise<?Array<CodeLensData>> {
    return Promise.resolve(null);
  }

  resolveCodeLens(
    filePath: NuclideUri,
    codeLens: CodeLensData,
  ): Promise<?CodeLensData> {
    return Promise.resolve(null);
  }

  getAdditionalLogFiles(
    deadline: DeadlineRequest,
  ): Promise<Array<AdditionalLogFile>> {
    return Promise.resolve([]);
  }

  getCodeActions(
    fileVersion: FileVersion,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    return Promise.resolve([]);
  }

  typeHint(fileVersion: FileVersion, position: atom$Point): Promise<?TypeHint> {
    return Promise.resolve(null);
  }

  highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    return Promise.resolve(null);
  }

  formatSource(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    return Promise.resolve(null);
  }

  formatEntireFile(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }> {
    return Promise.resolve(null);
  }

  formatAtPosition(
    fileVersion: FileVersion,
    position: atom$Point,
    triggerCharacter: string,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    return Promise.resolve(null);
  }

  signatureHelp(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?SignatureHelp> {
    return Promise.resolve(null);
  }

  supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean> {
    return Promise.resolve(false);
  }

  symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>> {
    return Promise.resolve(null);
  }

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri> {
    return Promise.resolve(null);
  }

  isFileInProject(fileUri: NuclideUri): Promise<boolean> {
    return Promise.resolve(false);
  }

  getExpandedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
  ): Promise<?atom$Range> {
    return Promise.resolve(null);
  }

  getCollapsedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range> {
    return Promise.resolve(null);
  }

  observeStatus(fileVersion: FileVersion): ConnectableObservable<StatusData> {
    return Observable.of({kind: 'null'}).publish();
  }

  async clickStatus(
    fileVersion: FileVersion,
    id: string,
    button: string,
  ): Promise<void> {}

  onWillSave(fileVersion: FileVersion): ConnectableObservable<TextEdit> {
    return Observable.empty().publish();
  }

  async sendLspRequest(
    filePath: NuclideUri,
    method: string,
    params: mixed,
  ): Promise<mixed> {}

  async sendLspNotification(method: string, params: mixed): Promise<void> {}

  observeLspNotifications(
    notificationMethod: string,
  ): ConnectableObservable<mixed> {
    return Observable.empty().publish();
  }

  dispose(): void {}
}

// Assert that NullLanguageService satisifes the LanguageService interface:
(((null: any): NullLanguageService): LanguageService);
