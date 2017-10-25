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
import type {HostServices} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';
import type {ConnectableObservable} from 'rxjs';

import {timeoutAfterDeadline} from 'nuclide-commons/promise';
import {stringifyError} from 'nuclide-commons/string';
import {FileCache, ConfigObserver} from '../../nuclide-open-files-rpc';
import {Cache} from 'nuclide-commons/cache';
import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {compact} from 'nuclide-commons/observable';
import {arrayCompact, arrayFlatten, collect} from 'nuclide-commons/collection';
import {ConfigCache} from 'nuclide-commons/ConfigCache';
import {ensureInvalidations, NullLanguageService} from '..';

export class MultiProjectLanguageService<T: LanguageService = LanguageService> {
  // Maps project dir => LanguageService
  _processes: Cache<NuclideUri, Promise<?T>>;
  _resources: UniversalDisposable;
  _configCache: ConfigCache;
  _logger: log4js$Logger;
  // A promise for when AtomLanguageService has called into this feature
  _observeDiagnosticsPromise: Promise<void>;
  _observeDiagnosticsPromiseResolver: () => void;

  constructor() {
    this._observeDiagnosticsPromise = new Promise((resolve, reject) => {
      this._observeDiagnosticsPromiseResolver = resolve;
    });
  }

  initialize(
    logger: log4js$Logger,
    fileCache: FileCache,
    host: HostServices,
    projectFileNames: Array<string>,
    fileExtensions: Array<NuclideUri>,
    languageServiceFactory: (projectDir: NuclideUri) => Promise<?T>,
  ) {
    this._logger = logger;
    this._resources = new UniversalDisposable();
    this._configCache = new ConfigCache(projectFileNames);

    this._processes = new Cache(languageServiceFactory, value => {
      value.then(process => {
        if (process != null) {
          process.dispose();
        }
      });
    });

    this._resources.add(host, this._processes);

    // Observe projects as they are opened
    const configObserver = new ConfigObserver(
      fileCache,
      fileExtensions,
      filePath => this._configCache.getConfigDir(filePath),
    );
    this._resources.add(
      configObserver,
      configObserver.observeConfigs().subscribe(configs => {
        this._ensureProcesses(configs);
      }),
    );
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
    const promises: Array<
      Promise<?[LanguageService, string]>,
    > = filePaths.map(async filePath => {
      const service = await this._getLanguageServiceForFile(filePath);
      return service ? [service, filePath] : null;
    });

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

  // Ensures that the only attached LanguageServices are those
  // for the given configPaths.
  // Closes all LanguageServices not in configPaths, and starts
  // new LanguageServices for any paths in configPaths.
  _ensureProcesses(configPaths: Set<NuclideUri>): void {
    this._logger.info(
      `MultiProjectLanguageService ensureProcesses. ${Array.from(
        configPaths,
      ).join(', ')}`,
    );
    this._processes.setKeys(configPaths);
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

  async getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    request: AutocompleteRequest,
  ): Promise<?AutocompleteResult> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getAutocompleteSuggestions(fileVersion, position, request);
  }

  async getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getDefinition(fileVersion, position);
  }

  async findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).findReferences(fileVersion, position);
  }

  async getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    return (await this._getLanguageServiceForFile(filePath)).getCoverage(
      filePath,
    );
  }

  async getOutline(fileVersion: FileVersion): Promise<?Outline> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getOutline(fileVersion);
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

  async getEvaluationExpression(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression> {
    return (await this._getLanguageServiceForFile(
      fileVersion.filePath,
    )).getEvaluationExpression(fileVersion, position);
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

  dispose(): void {
    this._resources.dispose();
  }
}

// Enforces that an instance of MultiProjectLanguageService satisfies the LanguageService type
(((null: any): MultiProjectLanguageService<>): LanguageService);
