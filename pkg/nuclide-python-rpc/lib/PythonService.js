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
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  DefinitionQueryResult,
  DiagnosticMessageType,
  DiagnosticProviderUpdate,
  FileDiagnosticMessages,
  FindReferencesReturn,
  Outline,
  FileDiagnosticMessage,
  CodeAction,
} from 'atom-ide-ui';
import type {AutocompleteResult} from '../../nuclide-language-service/lib/LanguageService';
import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';
import type {ConnectableObservable} from 'rxjs';

import invariant from 'assert';
import {runCommand, ProcessExitError} from 'nuclide-commons/process';
import {maybeToString} from 'nuclide-commons/string';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import JediServerManager from './JediServerManager';
import {parseFlake8Output} from './flake8';
import {ServerLanguageService} from '../../nuclide-language-service-rpc';
import {itemsToOutline} from './outline';
import {Point, Range} from 'simple-text-buffer';
import {FileCache} from '../../nuclide-open-files-rpc';
import {getAutocompleteSuggestions} from './AutocompleteHelpers';
import {getDefinition} from './DefinitionHelpers';

export type PythonCompletion = {
  type: string,
  text: string,
  description?: string,
  params?: Array<string>,
};

export type PythonDefinition = {
  type: string,
  text: string,
  file: NuclideUri,
  line: number,
  column: number,
};

export type PythonReference = {
  type: string,
  text: string,
  file: NuclideUri,
  line: number,
  column: number,
  parentName?: string,
};

export type Position = {
  line: number,
  column: number,
};

export type PythonFunctionItem = {
  kind: 'function',
  name: string,
  start: Position,
  end: Position,
  children?: Array<PythonOutlineItem>,
  docblock?: string,
  params?: Array<string>,
};

export type PythonClassItem = {
  kind: 'class',
  name: string,
  start: Position,
  end: Position,
  children?: Array<PythonOutlineItem>,
  docblock?: string,
  // Class params, i.e. superclasses.
  params?: Array<string>,
};

export type PythonStatementItem = {
  kind: 'statement',
  name: string,
  start: Position,
  end: Position,
  docblock?: string,
};

export type PythonOutlineItem =
  | PythonFunctionItem
  | PythonClassItem
  | PythonStatementItem;

export type PythonDiagnostic = {
  file: NuclideUri,
  code: string,
  message: string,
  type: DiagnosticMessageType,
  line: number,
  column: number,
};

export type PythonServiceConfig = {
  showGlobalVariables: boolean,
  autocompleteArguments: boolean,
  includeOptionalArguments: boolean,
};

const serverManager = new JediServerManager();

export async function initialize(
  fileNotifier: FileNotifier,
  config: PythonServiceConfig,
): Promise<LanguageService> {
  return new ServerLanguageService(
    fileNotifier,
    new PythonSingleFileLanguageService(fileNotifier, config),
  );
}

class PythonSingleFileLanguageService {
  _fileCache: FileCache;
  _showGlobalVariables: boolean;
  _autocompleteArguments: boolean;
  _includeOptionalArguments: boolean;

  constructor(fileNotifier: FileNotifier, config: PythonServiceConfig) {
    invariant(fileNotifier instanceof FileCache);
    this._fileCache = fileNotifier;
    this._showGlobalVariables = config.showGlobalVariables;
    this._autocompleteArguments = config.autocompleteArguments;
    this._includeOptionalArguments = config.includeOptionalArguments;
  }

  async getCodeActions(
    filePath: NuclideUri,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    throw new Error('Not implemented');
  }

  getDiagnostics(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?DiagnosticProviderUpdate> {
    throw new Error('Not Yet Implemented');
  }

  observeDiagnostics(): ConnectableObservable<Array<FileDiagnosticMessages>> {
    throw new Error('Not Yet Implemented');
  }

  getAutocompleteSuggestions(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    activatedManually: boolean,
  ): Promise<AutocompleteResult> {
    return getAutocompleteSuggestions(
      serverManager,
      filePath,
      buffer,
      position,
      activatedManually,
      this._autocompleteArguments,
      this._includeOptionalArguments,
    );
  }

  getDefinition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return getDefinition(serverManager, filePath, buffer, position);
  }

  async findReferences(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    const result = await getReferences(
      filePath,
      buffer.getText(),
      position.row,
      position.column,
    );

    if (!result || result.length === 0) {
      return {type: 'error', message: 'No usages were found.'};
    }

    const symbolName = result[0].text;

    // Process this into the format nuclide-find-references expects.
    const references = result.map(ref => {
      return {
        uri: ref.file,
        name: ref.parentName,
        range: new Range(
          new Point(ref.line, ref.column),
          new Point(ref.line, ref.column + ref.text.length),
        ),
      };
    });

    // Choose the project root as baseUri, or if no project exists,
    // use the dirname of the src file.
    const baseUri =
      this._fileCache.getContainingDirectory(filePath) ||
      nuclideUri.dirname(filePath);

    return {
      type: 'data',
      baseUri,
      referencedSymbolName: symbolName,
      references,
    };
  }

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    throw new Error('Not Yet Implemented');
  }

  async getOutline(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?Outline> {
    const service = await serverManager.getJediService(filePath);
    const items = await service.get_outline(filePath, buffer.getText());

    if (items == null) {
      return null;
    }

    const mode = this._showGlobalVariables ? 'all' : 'constants';
    return {
      outlineTrees: itemsToOutline(mode, items),
    };
  }

  typeHint(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?TypeHint> {
    throw new Error('Not Yet Implemented');
  }

  highlight(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    throw new Error('Not Yet Implemented');
  }

  formatSource(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    range: atom$Range,
  ): Promise<?Array<TextEdit>> {
    throw new Error('Not Yet Implemented');
  }

  async formatEntireFile(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    range: atom$Range,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }> {
    const contents = buffer.getText();
    const start = range.start.row + 1;
    const end = range.end.row + 1;
    const libCommand = getFormatterPath();
    const dirName = nuclideUri.dirname(nuclideUri.getPath(filePath));

    let stdout;
    try {
      stdout = await runCommand(libCommand, ['--line', `${start}-${end}`], {
        cwd: dirName,
        input: contents,
        // At the moment, yapf outputs 3 possible exit codes:
        // 0 - success, no content change.
        // 2 - success, contents changed.
        // 1 - internal failure, most likely due to syntax errors.
        //
        // See: https://github.com/google/yapf/issues/228#issuecomment-198682079
        isExitError: exit => exit.exitCode === 1,
      }).toPromise();
    } catch (err) {
      throw new Error(`"${libCommand}" failed, likely due to syntax errors.`);
    }

    if (contents !== '' && stdout === '') {
      // Throw error if the yapf output is empty, which is almost never desirable.
      throw new Error('Empty output received from yapf.');
    }

    return {formatted: stdout};
  }

  formatAtPosition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    triggerCharacter: string,
  ): Promise<?Array<TextEdit>> {
    throw new Error('Not Yet Implemented');
  }

  getEvaluationExpression(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression> {
    throw new Error('Not Yet Implemented');
  }

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri> {
    throw new Error('Not Yet Implemented');
  }

  isFileInProject(fileUri: NuclideUri): Promise<boolean> {
    throw new Error('Not Yet Implemented');
  }

  dispose(): void {}
}

let formatterPath;
function getFormatterPath(): string {
  if (formatterPath != null) {
    return formatterPath;
  }

  formatterPath = 'yapf';

  try {
    // $FlowFB
    const findFormatterPath = require('./fb/find-formatter-path').default;
    const overridePath = findFormatterPath();
    if (overridePath != null) {
      formatterPath = overridePath;
    }
  } catch (e) {
    // Ignore.
  }

  return formatterPath;
}

export async function getReferences(
  src: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?Array<PythonReference>> {
  const service = await serverManager.getJediService(src);
  return service.get_references(src, contents, line, column);
}

// Set to false if flake8 isn't found, so we don't repeatedly fail.
let shouldRunFlake8 = true;

export async function getDiagnostics(
  src: NuclideUri,
  contents: string,
): Promise<Array<PythonDiagnostic>> {
  if (!shouldRunFlake8) {
    return [];
  }

  let result;
  try {
    result = await runLinterCommand(src, contents);
  } catch (err) {
    // A non-successful exit code can result in some cases that we want to ignore,
    // for example when an incorrect python version is specified for a source file.
    if (err instanceof ProcessExitError) {
      return [];
    } else if (err.errorCode === 'ENOENT') {
      // Don't throw if flake8 is not found on the user's system.
      // Don't retry again.
      shouldRunFlake8 = false;
      return [];
    }
    throw new Error(`flake8 failed with error: ${maybeToString(err.message)}`);
  }

  return parseFlake8Output(src, result);
}

async function runLinterCommand(
  src: NuclideUri,
  contents: string,
): Promise<string> {
  const dirName = nuclideUri.dirname(src);
  const configDir = await fsPromise.findNearestFile('.flake8', dirName);
  // flowlint-next-line sketchy-null-string:off
  const configPath = configDir ? nuclideUri.join(configDir, '.flake8') : null;

  let result;
  let runFlake8;
  try {
    // $FlowFB
    runFlake8 = require('./fb/run-flake8').default;
  } catch (e) {
    // Ignore.
  }

  if (runFlake8 != null) {
    result = await runFlake8(src, contents, configPath);
    if (result != null) {
      return result;
    }
  }

  const command =
    (global.atom && atom.config.get('nuclide.nuclide-python.pathToFlake8')) ||
    'flake8';
  const args = [];

  // flowlint-next-line sketchy-null-string:off
  if (configPath) {
    args.push('--config');
    args.push(configPath);
  }

  // Read contents from stdin.
  args.push('-');
  invariant(typeof command === 'string');
  return runCommand(command, args, {
    cwd: dirName,
    input: contents,
    // 1 indicates unclean lint result (i.e. has errors/warnings).
    isExitError: exit => exit.exitCode == null || exit.exitCode > 1,
  }).toPromise();
}
