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
import type {SearchStrategy} from 'nuclide-commons/ConfigCache';
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
import type {HostServices} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {ConnectableObservable} from 'rxjs';

import invariant from 'assert';
import {timeoutAfterDeadline} from 'nuclide-commons/promise';
import {stringifyError} from 'nuclide-commons/string';
import {FileCache} from '../../nuclide-open-files-rpc';
import {Cache} from 'nuclide-commons/cache';
import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {compact} from 'nuclide-commons/observable';
import {arrayCompact, arrayFlatten, collect} from 'nuclide-commons/collection';
import {ConfigCache} from 'nuclide-commons/ConfigCache';
import {ensureInvalidations} from './ServerLanguageService';
import {NullLanguageService} from './NullLanguageService';

export class MultiProjectLanguageService<T: LanguageService = LanguageService> {
  // Maps project dir => LanguageService
  _processes: Cache<NuclideUri, Promise<?T>>;
  _resources: UniversalDisposable;
  _configCache: ConfigCache;
  _logger: log4js$Logger;
  // Promises for when AtomLanguageService has called into this feature
  _observeDiagnosticsPromise: Promise<void>;
  _observeDiagnosticsPromiseResolver: () => void;
  _observeStatusPromise: Promise<void>;
  _observeStatusPromiseResolver: () => void;

  constructor() {
    this._observeDiagnosticsPromise = new Promise((resolve, reject) => {
      this._observeDiagnosticsPromiseResolver = resolve;
    });
    this._observeStatusPromise = new Promise((resolve, reject) => {
      this._observeStatusPromiseResolver = resolve;
    });
  }

  initialize(
    logger: log4js$Logger,
    fileCache: FileCache,
    host: HostServices,
    projectFileNames: Array<string>,
    projectFileSearchStrategy: ?SearchStrategy,
    fileExtensions: Array<NuclideUri>,
    languageServiceFactory: (projectDir: NuclideUri) => Promise<?T>,
  ) {
    this._logger = logger;
    this._resources = new UniversalDisposable();
    this._configCache = new ConfigCache(
      projectFileNames,
      projectFileSearchStrategy != null ? projectFileSearchStrategy : undefined,
    );

    this._processes = new Cache(languageServiceFactory, value => {
      value.then(process => {
        if (process != null) {
          process.dispose();
        }
      });
    });

    this._resources.add(host, this._processes);

    this._resources.add(() => {
      this._closeProcesses();
    });

    // Remove fileCache when the remote connection shuts down
    this._resources.add(
      fileCache
        .observeFileEvents()
        .ignoreElements()
        .subscribe(
          undefined, // next
          undefined, // error
          () => {
            this._logger.info('fileCache shutting down.');
            this._closeProcesses();
          },
        ),
    );
  }

  findProjectDir(filePath: NuclideUri): Promise<?NuclideUri> {
    return this._configCache.getConfigDir(filePath);
  }

  async _getLanguageServiceForFile(filePath: string): Promise<LanguageService> {
    const service = await this.getLanguageServiceForFile(filePath);
    if (service != null) {
      return service;
    } else {
      return new NullLanguageService();
    }
  }

  async _getLanguageServicesForFiles(
    filePaths: Array<string>,
  ): Promise<Array<[LanguageService, Array<string>]>> {
    const promises: Array<Promise<?[LanguageService, string]>> = filePaths.map(
      async filePath => {
        const service = await this._getLanguageServiceForFile(filePath);
        return service ? [service, filePath] : null;
      },
    );

    const fileServices: Array<?[LanguageService, string]> = await Promise.all(
      promises,
    );

    const results: Map<LanguageService, Array<string>> = collect(
      arrayCompact(fileServices),
    );

    return Array.from(results);
  }

  async getLanguageServiceForFile(filePath: string): Promise<?T> {
    const projectDir = await this.findProjectDir(filePath);
    if (projectDir == null) {
      return null;
    }

    const process = this._processes.get(projectDir);
    process.then(result => {
      // If we fail to connect, then retry on next request.
      if (result == null) {
        this._processes.delete(projectDir);
      }
    });
    return process;
  }

  // Closes all LanguageServices for this fileCache.
  _closeProcesses(): void {
    this._logger.info(
      'Shutting down LanguageServices ' +
        `${Array.from(this._processes.keys()).join(',')}`,
    );
    this._processes.clear();
  }

  observeLanguageServices(): Observable<T> {
    this._logger.info('observing connections');
    return compact(
      this._processes
        .observeValues()
        .switchMap(process => Observable.fromPromise(process)),
    );
  }

  async getAllLanguageServices(): Promise<Array<T>> {
    const lsPromises: Array<Promise<?T>> = [...this._processes.values()];
    return arrayCompact(await Promise.all(lsPromises));
  }

  async getDiagnostics(fileVersion: FileVersion): Promise<?FileDiagnosticMap> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getDiagnostics(fileVersion);
  }

  hasObservedDiagnostics(): Promise<void> {
    return this._observeDiagnosticsPromise;
  }

  observeDiagnostics(): ConnectableObservable<FileDiagnosticMap> {
    this._observeDiagnosticsPromiseResolver();

    return this.observeLanguageServices()
      .mergeMap((process: LanguageService) => {
        this._logger.trace('observeDiagnostics');
        return ensureInvalidations(
          this._logger,
          process
            .observeDiagnostics()
            .refCount()
            .catch(error => {
              this._logger.error('Error: observeDiagnostics', error);
              return Observable.empty();
            }),
        );
      })
      .publish();
  }

  hasObservedStatus(): Promise<void> {
    return this._observeStatusPromise;
  }

  observeStatus(fileVersion: FileVersion): ConnectableObservable<StatusData> {
    this._observeStatusPromiseResolver();
    return Observable.fromPromise(
      this._getLanguageServiceForFile(fileVersion.filePath),
    )
      .flatMap(ls => ls.observeStatus(fileVersion).refCount())
      .publish();
  }

  async clickStatus(
    fileVersion: FileVersion,
    id: string,
    button: string,
  ): Promise<void> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).clickStatus(fileVersion, id, button);
  }

  async getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    request: AutocompleteRequest,
  ): Promise<?AutocompleteResult> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getAutocompleteSuggestions(fileVersion, position, request);
  }

  async resolveAutocompleteSuggestion(
    suggestion: Completion,
  ): Promise<?Completion> {
    invariant(
      suggestion.remoteUri != null,
      'remoteUri for autocomplete resolution should have been set by AutocompleteProvider.',
    );

    // We're running this "locally" (from RPC point of view), so strip remote
    // URIs and just take the path.
    const languageService = await this._getLanguageServiceForFile(
      suggestion.remoteUri,
    );
    return languageService.resolveAutocompleteSuggestion(suggestion);
  }

  async getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getDefinition(fileVersion, position);
  }

  findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): ConnectableObservable<?FindReferencesReturn> {
    return Observable.fromPromise(
      this._getLanguageServiceForFile(fileVersion.filePath),
    )
      .concatMap(ls => ls.findReferences(fileVersion, position).refCount())
      .publish();
  }

  rename(
    fileVersion: FileVersion,
    position: atom$Point,
    newName: string,
  ): ConnectableObservable<?RenameReturn> {
    return Observable.fromPromise(
      this._getLanguageServiceForFile(fileVersion.filePath),
    )
      .concatMap(ls => ls.rename(fileVersion, position, newName).refCount())
      .publish();
  }

  async getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    return (await this._getLanguageServiceForFile(filePath)).getCoverage(
      filePath,
    );
  }

  async onToggleCoverage(set: boolean): Promise<void> {
    await Promise.all(
      (await this.getAllLanguageServices()).map(async languageService => {
        const ls = await languageService;
        ls.onToggleCoverage(set);
      }),
    );
  }

  async getOutline(fileVersion: FileVersion): Promise<?Outline> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getOutline(fileVersion);
  }

  async getCodeLens(fileVersion: FileVersion): Promise<?Array<CodeLensData>> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getCodeLens(fileVersion);
  }

  async resolveCodeLens(
    filePath: NuclideUri,
    codeLens: CodeLensData,
  ): Promise<?CodeLensData> {
    return (await this._getLanguageServiceForFile(filePath)).resolveCodeLens(
      filePath,
      codeLens,
    );
  }

  async getAdditionalLogFiles(
    deadline: DeadlineRequest,
  ): Promise<Array<AdditionalLogFile>> {
    const roots: Array<NuclideUri> = Array.from(this._processes.keys());

    const results = await Promise.all(
      roots.map(async root => {
        try {
          const service = await timeoutAfterDeadline(
            deadline,
            this._processes.get(root),
          );
          if (service == null) {
            return [{title: root, data: 'no language service'}];
          } else {
            return timeoutAfterDeadline(
              deadline,
              service.getAdditionalLogFiles(deadline - 1000),
            );
          }
        } catch (e) {
          return [{title: root, data: stringifyError(e)}];
        }
      }),
    );
    return arrayFlatten(results);
  }

  async getCodeActions(
    fileVersion: FileVersion,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getCodeActions(fileVersion, range, diagnostics);
  }

  async typeHint(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?TypeHint> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).typeHint(fileVersion, position);
  }

  async highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).highlight(fileVersion, position);
  }

  async formatSource(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).formatSource(fileVersion, range, options);
  }

  async formatEntireFile(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).formatEntireFile(fileVersion, range, options);
  }

  async formatAtPosition(
    fileVersion: FileVersion,
    position: atom$Point,
    triggerCharacter: string,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).formatAtPosition(fileVersion, position, triggerCharacter, options);
  }

  async signatureHelp(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?SignatureHelp> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).signatureHelp(fileVersion, position);
  }

  async supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean> {
    const serviceDirectories = await this._getLanguageServicesForFiles(
      directories,
    );
    const eligibilities = await Promise.all(
      serviceDirectories.map(([service, dirs]) =>
        service.supportsSymbolSearch(dirs),
      ),
    );
    return eligibilities.some(e => e);
  }

  async symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>> {
    if (query.length === 0) {
      return [];
    }
    const serviceDirectories = await this._getLanguageServicesForFiles(
      directories,
    );
    const results = await Promise.all(
      serviceDirectories.map(([service, dirs]) =>
        service.symbolSearch(query, dirs),
      ),
    );
    return arrayFlatten(arrayCompact(results));
  }

  async getProjectRoot(filePath: NuclideUri): Promise<?NuclideUri> {
    return (await this._getLanguageServiceForFile(filePath)).getProjectRoot(
      filePath,
    );
  }

  async isFileInProject(filePath: NuclideUri): Promise<boolean> {
    return (await this._getLanguageServiceForFile(filePath)).isFileInProject(
      filePath,
    );
  }

  async getExpandedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
  ): Promise<?atom$Range> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getExpandedSelectionRange(fileVersion, currentSelection);
  }

  async getCollapsedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getCollapsedSelectionRange(
      fileVersion,
      currentSelection,
      originalCursorPosition,
    );
  }

  onWillSave(fileVersion: FileVersion): ConnectableObservable<TextEdit> {
    return Observable.fromPromise(
      this._getLanguageServiceForFile(fileVersion.filePath),
    )
      .flatMap(languageService =>
        languageService.onWillSave(fileVersion).refCount(),
      )
      .publish();
  }

  async sendLspRequest(
    filePath: NuclideUri,
    method: string,
    params: mixed,
  ): Promise<mixed> {
    return (await this._getLanguageServiceForFile(filePath)).sendLspRequest(
      filePath,
      method,
      params,
    );
  }

  async sendLspNotification(method: string, params: mixed): Promise<void> {
    const languageServices = await this.getAllLanguageServices();
    languageServices.forEach(service =>
      service.sendLspNotification(method, params),
    );
  }

  observeLspNotifications(
    notificationMethod: string,
  ): ConnectableObservable<mixed> {
    return this.observeLanguageServices()
      .mergeMap((process: LanguageService) =>
        process
          .observeLspNotifications(notificationMethod)
          .refCount()
          .catch(error => {
            this._logger.error('Error: observeLspNotifications', error);
            return Observable.empty();
          }),
      )
      .publish();
  }

  dispose(): void {
    this._resources.dispose();
  }
}

// Enforces that an instance of MultiProjectLanguageService satisfies the LanguageService type
(((null: any): MultiProjectLanguageService<>): LanguageService);
