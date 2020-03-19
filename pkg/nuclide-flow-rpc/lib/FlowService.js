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

import type {DeadlineRequest} from 'nuclide-commons/promise';
import type {ConnectableObservable} from 'rxjs';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  AutocompleteRequest,
  AutocompleteResult,
  FileDiagnosticMap,
  FileDiagnosticMessage,
  FormatOptions,
  SymbolResult,
  Completion,
  CodeLensData,
  StatusData,
} from '../../nuclide-language-service/lib/LanguageService';
import type {HostServices} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {AdditionalLogFile} from '../../nuclide-logging/lib/rpc-types';
import type {
  FileVersion,
  FileNotifier,
} from '../../nuclide-open-files-rpc/lib/rpc-types';
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

import invariant from 'assert';

import {Observable} from 'rxjs';
import {setConfig} from './config';
import {
  ServerLanguageService,
  MultiProjectLanguageService,
} from '../../nuclide-language-service-rpc';
import {FileCache, getBufferAtVersion} from '../../nuclide-open-files-rpc';

import {getLogger} from 'log4js';

export type Loc = {
  file: NuclideUri,
  point: atom$Point,
};

// If types are added here, make sure to also add them to FlowConstants.js. This needs to be the
// canonical type definition so that we can use these in the service framework.
export type ServerStatusType =
  | 'failed'
  | 'unknown'
  | 'not running'
  | 'not installed'
  | 'busy'
  | 'init'
  | 'ready';

export type ServerStatusUpdate = {
  pathToRoot: NuclideUri,
  status: ServerStatusType,
};

export type FlowSettings = {
  functionSnippetShouldIncludeArguments: boolean,
  stopFlowOnExit: boolean,
  lazyMode: boolean,
  canUseFlowBin: boolean,
  pathToFlow: string,
};

export type {FlowLocNoSource} from './flowOutputTypes';

import {FlowSingleProjectLanguageService} from './FlowSingleProjectLanguageService';
import {FlowServiceState} from './FlowServiceState';

let state: ?FlowServiceState = null;

function getState(): FlowServiceState {
  if (state == null) {
    state = new FlowServiceState();
  }
  return state;
}

export function dispose(): void {
  if (state != null) {
    state.dispose();
    state = null;
  }
}

export async function initialize(
  fileNotifier: FileNotifier,
  host: HostServices,
  config: FlowSettings,
): Promise<FlowLanguageServiceType> {
  invariant(fileNotifier instanceof FileCache);
  const fileCache: FileCache = fileNotifier;
  return new FlowLanguageService(fileCache, host, config);
}

class FlowLanguageService extends MultiProjectLanguageService<
  ServerLanguageService<FlowSingleProjectLanguageService>,
> {
  constructor(fileCache: FileCache, host: HostServices, config: FlowSettings) {
    const logger = getLogger('Flow');
    super();
    this.initialize(
      logger,
      fileCache,
      host,
      ['.flowconfig'],
      'nearest',
      ['.js', '.jsx'],
      projectDir => {
        const execInfoContainer = getState().getExecInfoContainer();
        const singleProjectLS = new FlowSingleProjectLanguageService(
          projectDir,
          execInfoContainer,
          fileCache,
        );
        const languageService = new ServerLanguageService(
          fileCache,
          singleProjectLS,
        );
        return Promise.resolve(languageService);
      },
    );
    for (const key of Object.keys(config)) {
      setConfig(key, config[key]);
    }
  }

  async getOutline(fileVersion: FileVersion): Promise<?Outline> {
    const ls = await this.getLanguageServiceForFile(fileVersion.filePath);
    if (ls != null) {
      return ls.getOutline(fileVersion);
    } else {
      const buffer = await getBufferAtVersion(fileVersion);
      if (buffer == null) {
        return null;
      }
      return FlowSingleProjectLanguageService.getOutline(
        fileVersion.filePath,
        buffer,
        null,
        getState().getExecInfoContainer(),
      );
    }
  }

  customFindReferences(
    fileVersion: FileVersion,
    position: atom$Point,
    global_: boolean,
    multiHop: boolean,
  ): ConnectableObservable<?FindReferencesReturn> {
    return Observable.defer(async () => {
      const ls = await this.getLanguageServiceForFile(fileVersion.filePath);
      if (ls == null) {
        return;
      }
      const flowLs = ls.getSingleFileLanguageService();
      const buffer = await getBufferAtVersion(fileVersion);
      if (buffer == null) {
        return null;
      }
      return flowLs.customFindReferences(
        fileVersion.filePath,
        buffer,
        position,
        global_,
        multiHop,
      );
    }).publish();
  }

  getServerStatusUpdates(): ConnectableObservable<ServerStatusUpdate> {
    return this.observeLanguageServices()
      .mergeMap(languageService => {
        const singleProjectLS: FlowSingleProjectLanguageService = languageService.getSingleFileLanguageService();
        const pathToRoot = singleProjectLS.getPathToRoot();
        return singleProjectLS
          .getServerStatusUpdates()
          .map(status => ({pathToRoot, status}));
      })
      .publish();
  }

  async allowServerRestart(): Promise<void> {
    const languageServices = await this.getAllLanguageServices();
    const flowLanguageServices = languageServices.map(ls =>
      ls.getSingleFileLanguageService(),
    );
    flowLanguageServices.forEach(ls => ls.allowServerRestart());
  }
}

// Unfortunately we have to duplicate a lot of things here to make FlowLanguageService remotable.
export interface FlowLanguageServiceType {
  getDiagnostics(fileVersion: FileVersion): Promise<?FileDiagnosticMap>;

  observeDiagnostics(): ConnectableObservable<FileDiagnosticMap>;

  getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    request: AutocompleteRequest,
  ): Promise<?AutocompleteResult>;

  resolveAutocompleteSuggestion(suggestion: Completion): Promise<?Completion>;

  getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult>;

  findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): ConnectableObservable<?FindReferencesReturn>;

  customFindReferences(
    fileVersion: FileVersion,
    position: atom$Point,
    global_: boolean,
    multiHop: boolean,
  ): ConnectableObservable<?FindReferencesReturn>;

  rename(
    fileVersion: FileVersion,
    position: atom$Point,
    newName: string,
  ): ConnectableObservable<?RenameReturn>;

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult>;

  getOutline(fileVersion: FileVersion): Promise<?Outline>;

  onToggleCoverage(set: boolean): Promise<void>;

  getCodeLens(fileVersion: FileVersion): Promise<?Array<CodeLensData>>;
  resolveCodeLens(
    filePath: NuclideUri,
    codeLens: CodeLensData,
  ): Promise<?CodeLensData>;

  getCodeActions(
    fileVersion: FileVersion,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>>;

  getAdditionalLogFiles(
    deadline: DeadlineRequest,
  ): Promise<Array<AdditionalLogFile>>;

  typeHint(fileVersion: FileVersion, position: atom$Point): Promise<?TypeHint>;

  highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>>;

  formatSource(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>>;

  formatEntireFile(
    fileVersion: FileVersion,
    range: atom$Range,
    options: FormatOptions,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }>;

  formatAtPosition(
    fileVersion: FileVersion,
    position: atom$Point,
    triggerCharacter: string,
    options: FormatOptions,
  ): Promise<?Array<TextEdit>>;

  signatureHelp(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?SignatureHelp>;

  supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean>;

  symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>>;

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri>;

  isFileInProject(fileUri: NuclideUri): Promise<boolean>;

  getServerStatusUpdates(): ConnectableObservable<ServerStatusUpdate>;

  allowServerRestart(): Promise<void>;

  getExpandedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
  ): Promise<?atom$Range>;

  getCollapsedSelectionRange(
    fileVersion: FileVersion,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range>;

  observeStatus(fileVersion: FileVersion): ConnectableObservable<StatusData>;

  clickStatus(
    fileVersion: FileVersion,
    id: string,
    button: string,
  ): Promise<void>;

  onWillSave(fileVersion: FileVersion): ConnectableObservable<TextEdit>;

  sendLspRequest(
    filePath: NuclideUri,
    method: string,
    params: mixed,
  ): Promise<mixed>;

  sendLspNotification(method: string, params: mixed): Promise<void>;

  observeLspNotifications(
    notificationMethod: string,
  ): ConnectableObservable<mixed>;

  dispose(): void;
}

export function flowGetAst(
  file: ?NuclideUri,
  currentContents: string,
): Promise<?any> {
  return FlowSingleProjectLanguageService.flowGetAst(
    null,
    currentContents,
    getState().getExecInfoContainer(),
  );
}
