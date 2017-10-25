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
import {wordAtPositionFromBuffer} from 'nuclide-commons/range';
import type {DeadlineRequest} from 'nuclide-commons/promise';
import type {AdditionalLogFile} from '../../nuclide-logging/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  AutocompleteResult,
  Completion,
  FileDiagnosticMap,
  FileDiagnosticMessage,
} from '../../nuclide-language-service/lib/LanguageService';
import type {
  DefinitionQueryResult,
  FindReferencesReturn,
  Reference,
  Outline,
  CodeAction,
} from 'atom-ide-ui';
import type {SingleFileLanguageService} from '../../nuclide-language-service-rpc';
import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';

import type {PushDiagnosticsMessage} from './FlowIDEConnection';

import type {ServerStatusType} from '..';
import type {FlowExecInfoContainer} from './FlowExecInfoContainer';
import type {
  FlowAutocompleteOutput,
  FlowAutocompleteItem,
  TypeAtPosOutput,
  FlowStatusOutput,
  FindRefsOutput,
  FlowLoc,
} from './flowOutputTypes';

import invariant from 'assert';
import {Range, Point} from 'simple-text-buffer';
import {getConfig} from './config';
import {Observable} from 'rxjs';

import {setUnion, mapGetWithDefault} from 'nuclide-commons/collection';
import {
  filterResultsByPrefix,
  getReplacementPrefix,
  JAVASCRIPT_WORD_REGEX,
} from '../../nuclide-flow-common';
import {getLogger} from 'log4js';
const logger = getLogger('nuclide-flow-rpc');

import {flowCoordsToAtomCoords} from '../../nuclide-flow-common';

import {FlowProcess} from './FlowProcess';
import {FlowVersion} from './FlowVersion';
import prettyPrintTypes from './prettyPrintTypes';
import {astToOutline} from './astToOutline';
import {flowStatusOutputToDiagnostics} from './diagnosticsParser';

import type {FileCache} from '../../nuclide-open-files-rpc';

/** Encapsulates all of the state information we need about a specific Flow root */
export class FlowSingleProjectLanguageService {
  // The path to the directory where the .flowconfig is -- i.e. the root of the Flow project.
  _root: string;
  _process: FlowProcess;
  _version: FlowVersion;
  _execInfoContainer: FlowExecInfoContainer;

  constructor(
    root: string,
    execInfoContainer: FlowExecInfoContainer,
    fileCache: FileCache,
  ) {
    this._root = root;
    this._execInfoContainer = execInfoContainer;
    this._process = new FlowProcess(root, execInfoContainer, fileCache);
    this._version = new FlowVersion(async () => {
      const execInfo = await execInfoContainer.getFlowExecInfo(root);
      if (!execInfo) {
        return null;
      }
      return execInfo.flowVersion;
    });
    this._process
      .getServerStatusUpdates()
      .filter(state => state === 'not running')
      .subscribe(() => this._version.invalidateVersion());
  }

  dispose(): void {
    this._process.dispose();
  }

  allowServerRestart(): void {
    this._process.allowServerRestart();
  }

  getPathToRoot(): string {
    return this._root;
  }

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri> {
    // TODO Consider an invariant to assert that fileUri is inside this root. However, that should
    // never happen since this will be enclosed by MultiProjectLanguageService which will dispatch
    // to the correct instance of this class.
    return Promise.resolve(this._root);
  }

  getServerStatusUpdates(): Observable<ServerStatusType> {
    return this._process.getServerStatusUpdates();
  }

  async getDefinition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    const match = wordAtPositionFromBuffer(
      buffer,
      position,
      JAVASCRIPT_WORD_REGEX,
    );
    if (match == null) {
      return null;
    }
    const line = position.row + 1;
    const column = position.column + 1;
    const options = {};
    // We pass the current contents of the buffer to Flow via stdin.
    // This makes it possible for get-def to operate on the unsaved content in
    // the user's editor rather than what is saved on disk. It would be annoying
    // if the user had to save before using the jump-to-definition feature to
    // ensure he or she got accurate results.
    options.input = buffer.getText();

    const args = ['get-def', '--json', '--path', filePath, line, column];
    try {
      const result = await this._process.execFlow(args, options);
      if (!result) {
        return null;
      }
      const json = parseJSON(args, result.stdout);
      if (json.path) {
        const loc = {
          file: json.path,
          point: new Point(json.line - 1, json.start - 1),
        };
        return {
          queryRange: [match.range],
          definitions: [
            {
              path: loc.file,
              position: loc.point,
              language: 'Flow',
            },
          ],
        };
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  async highlight(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    // `flow find-refs` came out in v0.38.0
    // https://github.com/facebook/flow/releases/tag/v0.38.0
    const isSupported = await this._version.satisfies('>=0.38.0');
    if (!isSupported) {
      return null;
    }
    const result = await this._findRefs(filePath, buffer, position, false);
    if (result == null || result.type === 'error') {
      return null;
    }
    return result.references.map(ref => ref.range);
  }

  async _findRefs(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    global_: boolean,
  ): Promise<?FindReferencesReturn> {
    const options = {input: buffer.getText()};
    const args = [
      'find-refs',
      '--json',
      '--path',
      filePath,
      position.row + 1,
      position.column + 1,
    ];
    if (global_) {
      args.push('--global');
    }
    try {
      const result = await this._process.execFlow(args, options);
      if (result == null) {
        return null;
      }
      const json: FindRefsOutput = parseJSON(args, result.stdout);
      return convertFindRefsOutput(json, this._root);
    } catch (e) {
      logger.error(`flowFindRefs error: ${String(e)}`);
      return null;
    }
  }

  /**
   * If currentContents is null, it means that the file has not changed since
   * it has been saved, so we can avoid piping the whole contents to the Flow
   * process.
   */
  async getDiagnostics(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?FileDiagnosticMap> {
    await this._forceRecheck(filePath);

    const options = {};

    const args = ['status', '--json', filePath];

    let result;

    try {
      // Don't log errors if the command returns a nonzero exit code, because status returns nonzero
      // if it is reporting any issues, even when it succeeds.
      result = await this._process.execFlow(
        args,
        options,
        /* waitForServer */ true,
      );
      if (!result) {
        return null;
      }
    } catch (e) {
      // This codepath will be exercised when Flow finds type errors as the
      // exit code will be non-zero. Note this codepath could also be exercised
      // due to a logical error in Nuclide, so we try to differentiate.
      if (e.exitCode !== undefined) {
        result = e;
      } else {
        logger.error(e);
        return null;
      }
    }

    let json;
    try {
      json = parseJSON(args, result.stdout);
    } catch (e) {
      return null;
    }

    const diagnostics = flowStatusOutputToDiagnostics(json);

    const filePathToMessages = new Map();

    for (const diagnostic of diagnostics) {
      const path = diagnostic.filePath;
      let diagnosticArray = filePathToMessages.get(path);
      if (!diagnosticArray) {
        diagnosticArray = [];
        filePathToMessages.set(path, diagnosticArray);
      }
      diagnosticArray.push(diagnostic);
    }

    return filePathToMessages;
  }

  observeDiagnostics(): Observable<FileDiagnosticMap> {
    const ideConnections = this._process.getIDEConnections();
    return ideConnections
      .switchMap(ideConnection => {
        if (ideConnection != null) {
          return ideConnection.observeDiagnostics();
        } else {
          // if ideConnection is null, it means there is currently no connection. So, invalidate the
          // current diagnostics so we don't display stale data.
          return Observable.of(null);
        }
      })
      .scan(updateDiagnostics, emptyDiagnosticsState())
      .concatMap(getDiagnosticUpdates)
      .catch(err => {
        logger.error(err);
        throw err;
      });
  }

  async getAutocompleteSuggestions(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    activatedManually: boolean,
    prefix: string,
  ): Promise<?AutocompleteResult> {
    const replacementPrefix = getReplacementPrefix(prefix);
    // We may want to make this configurable, but if it is ever higher than one we need to make sure
    // it works properly when the user manually activates it (e.g. with ctrl+space). See
    // https://github.com/atom/autocomplete-plus/issues/597
    //
    // If this is made configurable, consider using autocomplete-plus' minimumWordLength setting, as
    // per https://github.com/atom/autocomplete-plus/issues/594
    const minimumPrefixLength = 1;

    // Allows completions to immediately appear when we are completing off of object properties.
    // This also needs to be changed if minimumPrefixLength goes above 1, since after you type a
    // single alphanumeric character, autocomplete-plus no longer includes the dot in the prefix.
    const prefixHasDot =
      // charAt(index) returns an empty string if the index is out of bounds
      buffer.lineForRow(position.row).charAt(position.column - 1) === '.' ||
      prefix.indexOf('.') !== -1;

    if (
      !activatedManually &&
      !prefixHasDot &&
      replacementPrefix.length < minimumPrefixLength
    ) {
      return null;
    }

    // Note that Atom coordinates are 0-indexed whereas Flow's are 1-indexed, so we must add 1.
    const line = position.row + 1;
    const column = position.column + 1;
    const contents = buffer.getText();
    try {
      let json: FlowAutocompleteOutput;
      const ideConnection = this._process.getCurrentIDEConnection();
      if (
        ideConnection != null &&
        (await this._version.satisfies('>=0.48.0'))
      ) {
        json = await ideConnection.getAutocompleteSuggestions(
          filePath,
          line,
          column,
          contents,
        );
      } else {
        const args = ['autocomplete', '--json', filePath, line, column];
        const options = {input: contents};

        const result = await this._process.execFlow(args, options);
        if (!result) {
          return {isIncomplete: false, items: []};
        }
        json = (parseJSON(args, result.stdout): FlowAutocompleteOutput);
      }
      const resultsArray: Array<FlowAutocompleteItem> = json.result;
      const completions = resultsArray.map(item =>
        processAutocompleteItem(replacementPrefix, item),
      );
      return filterResultsByPrefix(prefix, {
        isIncomplete: false,
        items: completions,
      });
    } catch (e) {
      return {isIncomplete: false, items: []};
    }
  }

  async typeHint(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?TypeHint> {
    // Do not show typehints for whitespace.
    const character = buffer.getTextInRange([
      position,
      {
        row: position.row,
        column: position.column + 1,
      },
    ]);
    if (character.match(/\s/)) {
      return null;
    }

    const options = {};

    options.input = buffer.getText();

    const line = position.row + 1;
    const column = position.column + 1;
    const args = ['type-at-pos', '--json', '--path', filePath, line, column];

    let result;
    try {
      result = await this._process.execFlow(args, options);
    } catch (e) {
      result = null;
    }
    if (!result) {
      return null;
    }
    const output = result.stdout;

    let json;
    try {
      json = (parseJSON(args, output): TypeAtPosOutput);
    } catch (e) {
      return null;
    }
    const type = json.type;
    const range = flowCoordsToAtomCoords(json.loc);
    if (!type || type === '(unknown)') {
      return null;
    }
    let typeString;
    try {
      typeString = prettyPrintTypes(type);
    } catch (e) {
      logger.error(`Problem pretty printing type hint: ${e.message}`);
      typeString = type;
    }
    return {
      hint: typeString,
      range,
    };
  }

  async getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    const args = ['coverage', '--json', filePath];
    let result;
    try {
      result = await this._process.execFlow(args, {});
    } catch (e) {
      return null;
    }
    if (result == null) {
      return null;
    }
    let json;
    try {
      json = parseJSON(args, result.stdout);
    } catch (e) {
      // The error is already logged in parseJSON
      return null;
    }

    const expressions = json.expressions;

    const uncoveredCount = expressions.uncovered_count;
    const coveredCount = expressions.covered_count;
    const totalCount = uncoveredCount + coveredCount;

    const uncoveredRegions = expressions.uncovered_locs
      .map(flowCoordsToAtomCoords)
      .map(range => ({range}));

    return {
      percentage: totalCount === 0 ? 100 : coveredCount / totalCount * 100,
      uncoveredRegions,
    };
  }

  async _forceRecheck(file: string): Promise<boolean> {
    try {
      await this._process.execFlow(
        ['force-recheck', file],
        /* options */ {},
        // Make an attempt to force a recheck, but if the server is busy don't insist.
        /* waitsForServer */ false,
        /* suppressErrors */ true,
      );
      return true;
    } catch (e) {
      // This command was introduced in Flow v0.23, so silently swallow errors to avoid logspam on
      // earlier versions, until we want to break support for earlier version.
      return false;
    }
  }

  getOutline(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?Outline> {
    return FlowSingleProjectLanguageService.getOutline(
      filePath,
      buffer,
      this,
      this._execInfoContainer,
    );
  }

  // This static function takes an optional FlowRoot instance so that *if* it is part of a Flow
  // root, it can use the appropriate flow-bin installation (which may be the only Flow
  // installation) but if it lives outside of a Flow root, outlining still works using the system
  // Flow.
  static async getOutline(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    root: ?FlowSingleProjectLanguageService,
    execInfoContainer: FlowExecInfoContainer,
  ): Promise<?Outline> {
    const json = await FlowSingleProjectLanguageService.flowGetAst(
      root,
      buffer.getText(),
      execInfoContainer,
    );

    try {
      return json ? astToOutline(json) : null;
    } catch (e) {
      // Traversing the AST is an error-prone process and it's hard to be sure we've handled all the
      // cases. Fail gracefully if it does not work.
      logger.error(e);
      return null;
    }
  }

  static async flowGetAst(
    root: ?FlowSingleProjectLanguageService,
    currentContents: string,
    execInfoContainer: FlowExecInfoContainer,
  ): Promise<any> {
    const options = {
      input: currentContents,
    };

    const flowRootPath = root == null ? null : root.getPathToRoot();

    const args = ['ast'];

    let json;
    try {
      const result = await FlowProcess.execFlowClient(
        args,
        flowRootPath,
        execInfoContainer,
        options,
      );
      if (result == null) {
        return null;
      }
      json = parseJSON(args, result.stdout);
    } catch (e) {
      logger.warn(e);
      return null;
    }
    return json;
  }

  getCodeActions(
    filePath: NuclideUri,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    throw new Error('Not implemeneted');
  }

  async getAdditionalLogFiles(
    deadline: DeadlineRequest,
  ): Promise<Array<AdditionalLogFile>> {
    return [];
  }

  formatSource(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    range: atom$Range,
  ): Promise<?Array<TextEdit>> {
    throw new Error('Not Yet Implemented');
  }

  formatEntireFile(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    range: atom$Range,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }> {
    throw new Error('Not implemented');
  }

  formatAtPosition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    triggerCharacter: string,
  ): Promise<?Array<TextEdit>> {
    throw new Error('Not Yet Implemented');
  }

  findReferences(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    // TODO check flow version
    return this._findRefs(filePath, buffer, position, true);
  }

  getEvaluationExpression(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression> {
    throw new Error('Not implemented');
  }

  isFileInProject(fileUri: NuclideUri): Promise<boolean> {
    throw new Error('Not Yet Implemented');
  }

  getExpandedSelectionRange(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    currentSelection: atom$Range,
  ): Promise<?atom$Range> {
    throw new Error('Not Yet Implemented');
  }

  getCollapsedSelectionRange(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range> {
    throw new Error('Not Yet Implemented');
  }
}

// FlowSingleProjectLanguageService should satisfy the SingleFileLanguageService interface
(((null: any): FlowSingleProjectLanguageService): SingleFileLanguageService);

function parseJSON(args: Array<any>, value: string): any {
  try {
    return JSON.parse(value);
  } catch (e) {
    logger.warn(
      `Invalid JSON result from flow ${args.join(' ')}. JSON:\n'${value}'.`,
    );
    throw e;
  }
}

/**
 * Takes an autocomplete item from Flow and returns a valid autocomplete-plus
 * response, as documented here:
 * https://github.com/atom/autocomplete-plus/wiki/Provider-API
 */
export function processAutocompleteItem(
  replacementPrefix: string,
  flowItem: FlowAutocompleteItem,
): Completion {
  // Truncate long types for readability
  const description =
    flowItem.type.length < 80
      ? flowItem.type
      : flowItem.type.substring(0, 80) + ' ...';
  let result = {
    description,
    displayText: flowItem.name,
    replacementPrefix,
  };
  const funcDetails = flowItem.func_details;
  if (funcDetails) {
    // The parameters in human-readable form for use on the right label.
    const rightParamStrings = funcDetails.params.map(
      param => `${param.name}: ${param.type}`,
    );
    let snippetArgs = `(${getSnippetString(
      funcDetails.params.map(param => param.name),
    )})`;
    let leftLabel = funcDetails.return_type;
    let rightLabel = `(${rightParamStrings.join(', ')})`;
    if (!getConfig('functionSnippetShouldIncludeArguments')) {
      snippetArgs = '';
      leftLabel = undefined;
      rightLabel += ` => ${funcDetails.return_type}`;
    }
    result = {
      ...result,
      leftLabel,
      rightLabel,
      snippet: `${flowItem.name}${snippetArgs}`,
      type: 'function',
    };
  } else {
    result = {
      ...result,
      rightLabel: flowItem.type,
      text: flowItem.name,
    };
  }
  return result;
}

function getSnippetString(paramNames: Array<string>): string {
  const groupedParams = groupParamNames(paramNames);
  // The parameters turned into snippet strings.
  const snippetParamStrings = groupedParams
    .map(params => params.join(', '))
    .map((param, i) => `\${${i + 1}:${param}}`);
  return snippetParamStrings.join(', ');
}

/**
 * Group the parameter names so that all of the trailing optional parameters are together with the
 * last non-optional parameter. That makes it easy to ignore the optional parameters, since they
 * will be selected along with the last non-optional parameter and you can just type to overwrite
 * them.
 */
// Exported for testing
export function groupParamNames(
  paramNames: Array<string>,
): Array<Array<string>> {
  // Split the parameters into two groups -- all of the trailing optional paramaters, and the rest
  // of the parameters. Trailing optional means all optional parameters that have only optional
  // parameters after them.
  const [ordinaryParams, trailingOptional] = paramNames.reduceRight(
    ([ordinary, optional], param) => {
      // If there have only been optional params so far, and this one is optional, add it to the
      // list of trailing optional params.
      if (isOptional(param) && ordinary.length === 0) {
        optional.unshift(param);
      } else {
        ordinary.unshift(param);
      }
      return [ordinary, optional];
    },
    [[], []],
  );

  const groupedParams = ordinaryParams.map(param => [param]);
  const lastParam = groupedParams[groupedParams.length - 1];
  if (lastParam != null) {
    lastParam.push(...trailingOptional);
  } else if (trailingOptional.length > 0) {
    groupedParams.push(trailingOptional);
  }

  return groupedParams;
}

function isOptional(param: string): boolean {
  invariant(param.length > 0);
  const lastChar = param[param.length - 1];
  return lastChar === '?';
}

// This should be immutable, but lacking good immutable data structure implementations, we are just
// going to mutate it
// Exported only for testing
export type DiagnosticsState = {
  isInRecheck: boolean,
  // Stale messages from the last recheck. We still want to display these, but as soon as the
  // recheck ends we should invalidate them.
  // invariants: empty if we are not in a recheck, all contained messages have `stale: true`.
  staleMessages: Map<NuclideUri, Array<FileDiagnosticMessage>>,
  // All the currently-valid diagnostic messages. During a recheck, incoming messages get
  // accumulated here.
  currentMessages: Map<NuclideUri, Array<FileDiagnosticMessage>>,
  // All the files that need to be updated immediately. May include files that do not exist in
  // allCurrentMessages, meaning that there are no associated messages and we just need to clear the
  // previous errors.
  filesToUpdate: Set<NuclideUri>,
};

// Exported only for testing
export function emptyDiagnosticsState(): DiagnosticsState {
  return {
    isInRecheck: false,
    staleMessages: new Map(),
    currentMessages: new Map(),
    filesToUpdate: new Set(),
  };
}

// Exported only for testing
export function updateDiagnostics(
  state: DiagnosticsState,
  // null means we have received a null ide connection (meaning the previous one has gone away)
  msg: ?PushDiagnosticsMessage,
): DiagnosticsState {
  if (msg == null) {
    return {
      isInRecheck: false,
      staleMessages: new Map(),
      currentMessages: new Map(),
      filesToUpdate: setUnion(
        new Set(state.staleMessages.keys()),
        new Set(state.currentMessages.keys()),
      ),
    };
  }
  switch (msg.kind) {
    case 'errors':
      const newErrors = collateDiagnostics(msg.errors);
      if (state.isInRecheck) {
        // Yes we are going to mutate this :(
        const {currentMessages} = state;
        for (const [file, newMessages] of newErrors) {
          let messages = currentMessages.get(file);
          if (messages == null) {
            messages = [];
            currentMessages.set(file, messages);
          }
          messages.push(...newMessages);
        }
        return {
          isInRecheck: state.isInRecheck,
          staleMessages: state.staleMessages,
          currentMessages,
          filesToUpdate: new Set(newErrors.keys()),
        };
      } else {
        // Update the files that now have errors, and those that had errors the last time (we need
        // to make sure to remove errors that no longer exist).
        const filesToUpdate = setUnion(
          new Set(newErrors.keys()),
          new Set(state.currentMessages.keys()),
        );
        return {
          isInRecheck: state.isInRecheck,
          staleMessages: state.staleMessages,
          currentMessages: newErrors,
          filesToUpdate,
        };
      }
    case 'start-recheck':
      const staleMessages = new Map();
      for (const [file, oldMessages] of state.currentMessages.entries()) {
        const messages = oldMessages.map(
          message =>
            ({
              ...message,
              stale: true,
            }: any),
        );
        staleMessages.set(file, messages);
      }
      return {
        isInRecheck: true,
        staleMessages,
        currentMessages: new Map(),
        filesToUpdate: new Set(state.currentMessages.keys()),
      };
    case 'end-recheck':
      return {
        isInRecheck: false,
        staleMessages: new Map(),
        currentMessages: state.currentMessages,
        filesToUpdate: new Set(state.staleMessages.keys()),
      };
    default:
      // Enforce exhaustiveness
      (msg.kind: empty);
      throw new Error(`Unknown message kind ${msg.kind}`);
  }
}

// Exported only for testing
export function getDiagnosticUpdates(
  state: DiagnosticsState,
): Observable<FileDiagnosticMap> {
  const updates = new Map();
  for (const file of state.filesToUpdate) {
    const messages = [
      ...mapGetWithDefault(state.staleMessages, file, []),
      ...mapGetWithDefault(state.currentMessages, file, []),
    ];
    updates.set(file, messages);
  }
  return Observable.of(updates);
}

function collateDiagnostics(output: FlowStatusOutput): FileDiagnosticMap {
  const diagnostics = flowStatusOutputToDiagnostics(output);
  const filePathToMessages = new Map();

  for (const diagnostic of diagnostics) {
    const path = diagnostic.filePath;
    let diagnosticArray = filePathToMessages.get(path);
    if (!diagnosticArray) {
      diagnosticArray = [];
      filePathToMessages.set(path, diagnosticArray);
    }
    diagnosticArray.push(diagnostic);
  }
  return filePathToMessages;
}

function locsToReferences(locs: Array<FlowLoc>): Array<Reference> {
  return locs.map(loc => {
    return {
      name: null,
      range: new Range(
        new Point(loc.start.line - 1, loc.start.column - 1),
        new Point(loc.end.line - 1, loc.end.column),
      ),
      uri: loc.source,
    };
  });
}

function convertFindRefsOutput(
  output: FindRefsOutput,
  root: string,
): ?FindReferencesReturn {
  if (Array.isArray(output)) {
    return {
      type: 'data',
      baseUri: root,
      referencedSymbolName: '',
      references: locsToReferences(output),
    };
  } else {
    if (output.kind === 'no-symbol-found') {
      return null;
    } else {
      return {
        type: 'data',
        baseUri: root,
        referencedSymbolName: output.name,
        references: locsToReferences(output.locs),
      };
    }
  }
}
