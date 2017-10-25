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
import type {AdditionalLogFile} from '../../nuclide-logging/lib/rpc-types';
import type {FileVersion} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  DefinitionQueryResult,
  FindReferencesReturn,
  Outline,
  CodeAction,
} from 'atom-ide-ui';
import type {
  AutocompleteRequest,
  AutocompleteResult,
  FileDiagnosticMap,
  FileDiagnosticMessage,
  FormatOptions,
  LanguageService,
  SymbolResult,
} from '../../nuclide-language-service/lib/LanguageService';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {ConnectableObservable} from 'rxjs';
import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';

import invariant from 'assert';
import {getBufferAtVersion} from '../../nuclide-open-files-rpc';
import {FileCache} from '../../nuclide-open-files-rpc';
import {Observable} from 'rxjs';

// This is a version of the LanguageService interface which operates on a
// single modified file at a time. This provides a simplified interface
// for LanguageService implementors, at the cost of providing language analysis
// which can not reflect multiple edited files.
export type SingleFileLanguageService = {
  getDiagnostics(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?FileDiagnosticMap>,

  observeDiagnostics(): Observable<FileDiagnosticMap>,

  getAutocompleteSuggestions(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    activatedManually: boolean,
    prefix: string,
  ): Promise<?AutocompleteResult>,

  getDefinition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult>,

  findReferences(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?FindReferencesReturn>,

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult>,

  getOutline(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?Outline>,

  getCodeActions(
    filePath: NuclideUri,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>>,

  typeHint(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?TypeHint>,

  highlight(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?Array<atom$Range>>,

  formatSource(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>>,

  formatEntireFile(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }>,

  formatAtPosition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    triggerCharacter: string,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>>,

  getEvaluationExpression(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression>,

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri>,

  isFileInProject(fileUri: NuclideUri): Promise<boolean>,

  getExpandedSelectionRange(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    currentSelection: atom$Range,
  ): Promise<?atom$Range>,

  getCollapsedSelectionRange(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range>,

  dispose(): void,
};

export class ServerLanguageService<
  T: SingleFileLanguageService = SingleFileLanguageService,
> {
  _fileCache: FileCache;
  _service: T;

  constructor(fileNotifier: FileNotifier, service: T) {
    invariant(fileNotifier instanceof FileCache);
    this._fileCache = fileNotifier;
    this._service = service;
  }

  getSingleFileLanguageService(): T {
    return this._service;
  }

  async getDiagnostics(fileVersion: FileVersion): Promise<?FileDiagnosticMap> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.getDiagnostics(filePath, buffer);
  }

  observeDiagnostics(): ConnectableObservable<FileDiagnosticMap> {
    return this._service.observeDiagnostics().publish();
  }

  async getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    request: AutocompleteRequest,
  ): Promise<?AutocompleteResult> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      // TODO: this should return null so the empty list doesn't get cached
      return {isIncomplete: false, items: []};
    }
    return this._service.getAutocompleteSuggestions(
      filePath,
      buffer,
      position,
      request.activatedManually,
      request.prefix,
    );
  }

  async getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.getDefinition(filePath, buffer, position);
  }

  async findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.findReferences(filePath, buffer, position);
  }

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    return this._service.getCoverage(filePath);
  }

  async getAdditionalLogFiles(): Promise<Array<AdditionalLogFile>> {
    // TODO (if it's ever needed): push this request to the this._service
    return [];
  }

  async getCodeActions(
    fileVersion: FileVersion,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    const {filePath} = fileVersion;
    return this._service.getCodeActions(filePath, range, diagnostics);
  }

  async getOutline(fileVersion: FileVersion): Promise<?Outline> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.getOutline(filePath, buffer);
  }

  async typeHint(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?TypeHint> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.typeHint(filePath, buffer, position);
  }

  async highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return [];
    }
    return this._service.highlight(filePath, buffer, position);
  }

  async formatSource(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.formatSource(filePath, buffer, range, options);
  }

  async formatEntireFile(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.formatEntireFile(filePath, buffer, range, options);
  }

  async formatAtPosition(
    fileVersion: FileVersion,
    position: atom$Point,
    triggerCharacter: string,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.formatAtPosition(
      filePath,
      buffer,
      position,
      triggerCharacter,
      options,
    );
  }

  async getEvaluationExpression(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.getEvaluationExpression(filePath, buffer, position);
  }

  supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean> {
    return Promise.resolve(false);
    // A single-file language service by definition cannot offer
    // "project-wide symbol search". If you want your language to offer
    // symbols, you'll have to implement LanguageService directly.
  }

  symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>> {
    return Promise.resolve(null);
  }

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri> {
    return this._service.getProjectRoot(fileUri);
  }

  async isFileInProject(fileUri: NuclideUri): Promise<boolean> {
    return this._service.isFileInProject(fileUri);
  }

  async getExpandedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
  ): Promise<?atom$Range> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }

    return this._service.getExpandedSelectionRange(
      filePath,
      buffer,
      currentSelection,
    );
  }

  async getCollapsedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }

    return this._service.getCollapsedSelectionRange(
      filePath,
      buffer,
      currentSelection,
      originalCursorPosition,
    );
  }

  dispose(): void {
    this._service.dispose();
  }
}

// Assert that ServerLanguageService satisifes the LanguageService interface:
(((null: any): ServerLanguageService<>): LanguageService);

export function ensureInvalidations(
  logger: log4js$Logger,
  diagnostics: Observable<FileDiagnosticMap>,
): Observable<FileDiagnosticMap> {
  const filesWithErrors = new Set();
  const trackedDiagnostics: Observable<
    FileDiagnosticMap,
  > = diagnostics.do((diagnosticMap: FileDiagnosticMap) => {
    for (const [filePath, messages] of diagnosticMap) {
      if (messages.length === 0) {
        logger.debug(`Removing ${filePath} from files with errors`);
        filesWithErrors.delete(filePath);
      } else {
        logger.debug(`Adding ${filePath} to files with errors`);
        filesWithErrors.add(filePath);
      }
    }
  });

  const fileInvalidations: Observable<
    FileDiagnosticMap,
  > = Observable.defer(() => {
    logger.debug('Clearing errors after stream closed');
    return Observable.of(
      new Map(
        Array.from(filesWithErrors).map(file => {
          logger.debug(`Clearing errors for ${file} after connection closed`);
          return [file, []];
        }),
      ),
    );
  });

  return trackedDiagnostics.concat(fileInvalidations);
}
