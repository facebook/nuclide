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
  RenameReturn,
  Outline,
  CodeAction,
  SignatureHelp,
} from 'atom-ide-ui';
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
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {ConnectableObservable} from 'rxjs';

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

  resolveAutocompleteSuggestion(suggestion: Completion): Promise<?Completion>,

  getDefinition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult>,

  findReferences(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Observable<?FindReferencesReturn>,

  rename(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    newName: string,
  ): Observable<?RenameReturn>,

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult>,

  getOutline(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?Outline>,

  onToggleCoverage(set: boolean): Promise<void>,

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

  signatureHelp(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?SignatureHelp>,

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

  async resolveAutocompleteSuggestion(
    suggestion: Completion,
  ): Promise<?Completion> {
    return this._service.resolveAutocompleteSuggestion(suggestion);
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

  findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): ConnectableObservable<?FindReferencesReturn> {
    const filePath = fileVersion.filePath;
    return Observable.fromPromise(getBufferAtVersion(fileVersion))
      .concatMap(buffer => {
        if (buffer == null) {
          return Observable.of(null);
        }
        return this._service.findReferences(filePath, buffer, position);
      })
      .publish();
  }

  rename(
    fileVersion: FileVersion,
    position: atom$Point,
    newName: string,
  ): ConnectableObservable<?RenameReturn> {
    const filePath = fileVersion.filePath;
    return Observable.fromPromise(getBufferAtVersion(fileVersion))
      .concatMap(buffer => {
        if (buffer == null) {
          return Observable.of(null);
        }
        return this._service.rename(filePath, buffer, position, newName);
      })
      .publish();
  }

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    return this._service.getCoverage(filePath);
  }

  onToggleCoverage(set: boolean): Promise<void> {
    return this._service.onToggleCoverage(set);
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

  async getCodeLens(fileVersion: FileVersion): Promise<?Array<CodeLensData>> {
    return null;
  }

  async resolveCodeLens(
    filePath: NuclideUri,
    codeLens: CodeLensData,
  ): Promise<?CodeLensData> {
    return null;
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

  async signatureHelp(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?SignatureHelp> {
    const filePath = fileVersion.filePath;
    const buffer = await getBufferAtVersion(fileVersion);
    if (buffer == null) {
      return null;
    }
    return this._service.signatureHelp(filePath, buffer, position);
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

  observeStatus(fileVersion: FileVersion): ConnectableObservable<StatusData> {
    return Observable.of({kind: 'null'}).publish();
  }

  onWillSave(fileVersion: FileVersion): ConnectableObservable<TextEdit> {
    return Observable.empty().publish();
  }

  async clickStatus(
    fileVersion: FileVersion,
    id: string,
    button: string,
  ): Promise<void> {}

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
  const trackedDiagnostics: Observable<FileDiagnosticMap> = diagnostics.do(
    (diagnosticMap: FileDiagnosticMap) => {
      for (const [filePath, messages] of diagnosticMap) {
        if (messages.length === 0) {
          logger.trace(`Removing ${filePath} from files with errors`);
          filesWithErrors.delete(filePath);
        } else {
          logger.trace(`Adding ${filePath} to files with errors`);
          filesWithErrors.add(filePath);
        }
      }
    },
  );

  const fileInvalidations: Observable<FileDiagnosticMap> = Observable.defer(
    () => {
      logger.debug('Clearing errors after stream closed');
      return Observable.of(
        new Map(
          Array.from(filesWithErrors).map(file => {
            logger.debug(`Clearing errors for ${file} after connection closed`);
            return [file, []];
          }),
        ),
      );
    },
  );

  return trackedDiagnostics.concat(fileInvalidations);
}
