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

import child_process from 'child_process';
import DefinitionManager from '../../../nuclide-ui-component-tools-common/lib/definitionManager';
import {ExportManager} from './ExportManager';
import {UndefinedSymbolManager} from './UndefinedSymbolManager';
import * as babylon from '@babel/parser';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {babelLocationToAtomRange} from '../utils/util';
import {lspRangeToAtomRange} from '../../../nuclide-lsp-implementation-common/lsp-utils';
import {Range} from 'simple-text-buffer';
import {IRange} from 'vscode-languageserver';

import type {ImportSuggestion} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {JSExport, UndefinedSymbol} from './types';
import type {ExportUpdateForFile} from './AutoImportsWorker';

export const babylonOptions = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'flow',
    'exportExtensions',
    'objectRestSpread',
    'classProperties',
    'nullishCoalescingOperator',
    'optionalChaining',
    'optionalCatchBinding',
  ],
};

const logger = getLogger();

// Whether files that have disabled eslint with a comment should be ignored.
const IGNORE_ESLINT_DISABLED_FILES = true;

// Large files are slow to parse. Bail after a certain limit.
const LARGE_FILE_LIMIT = 2000000;

const MAX_CRASHES = 3;

type InitializationSettings = {|
  componentModulePathFilter: ?string,
|};

export class AutoImportsManager {
  initializationSettings: InitializationSettings;
  componentModulePathFilter: ?string;
  definitionManager: DefinitionManager;
  suggestedImports: Map<NuclideUri, Array<ImportSuggestion>>;
  exportsManager: ExportManager;
  undefinedSymbolsManager: UndefinedSymbolManager;
  crashes: number;
  worker: ?child_process$ChildProcess;

  constructor(
    globals: Array<string>,
    initializationSettings: InitializationSettings = {
      componentModulePathFilter: null,
    },
  ) {
    this.initializationSettings = initializationSettings;
    this.definitionManager = new DefinitionManager();
    this.suggestedImports = new Map();
    this.exportsManager = new ExportManager();
    this.undefinedSymbolsManager = new UndefinedSymbolManager(globals);
    this.crashes = 0;
  }

  getDefinitionManager(): DefinitionManager {
    return this.definitionManager;
  }

  // Only indexes the file (used for testing purposes)
  indexFile(fileUri: NuclideUri, code: string): void {
    const ast = parseFile(code);
    if (ast) {
      this.exportsManager.addFile(fileUri, ast);
    }
  }

  // Indexes an entire directory recursively in another process, watches for changes
  // and listens for messages from this process to index a file.
  indexAndWatchDirectory(root: NuclideUri) {
    logger.debug('Indexing the directory', root, 'recursively');
    const worker = child_process.fork(
      nuclideUri.join(__dirname, 'AutoImportsWorker-entry.js'),
      [root],
      {
        env: {
          ...process.env,
          JS_IMPORTS_INITIALIZATION_SETTINGS: JSON.stringify(
            this.initializationSettings,
          ),
        },
      },
    );
    worker.on('message', (updateForFile: Array<ExportUpdateForFile>) => {
      updateForFile.forEach(this.handleUpdateForFile.bind(this));
    });

    worker.on('exit', code => {
      logger.error(
        `AutoImportsWorker exited with code ${code} (retry: ${this.crashes})`,
      );
      this.crashes += 1;
      if (this.crashes < MAX_CRASHES) {
        this.indexAndWatchDirectory(root);
      } else {
        this.worker = null;
      }
    });

    this.worker = worker;
  }

  // Tells the AutoImportsWorker to index a file. indexAndWatchDirectory must be
  // called first on a directory that is a parent of fileUri.
  workerIndexFile(fileUri: NuclideUri, fileContents: string) {
    if (this.worker == null) {
      logger.debug(`Worker is not running when asked to index ${fileUri}`);
      return;
    }
    this.worker.send({fileUri, fileContents});
  }

  findMissingImports(
    fileUri: NuclideUri,
    code: string,
    onlyAvailableExports: boolean = true,
  ): Array<ImportSuggestion> {
    const ast = parseFile(code);
    return this.findMissingImportsInAST(fileUri, ast, onlyAvailableExports);
  }

  findMissingImportsInAST(
    fileUri: NuclideUri,
    ast: ?Object,
    onlyAvailableExports: boolean,
  ): Array<ImportSuggestion> {
    if (ast == null || checkEslint(ast)) {
      return [];
    }

    const missingImports = undefinedSymbolsToMissingImports(
      fileUri,
      this.undefinedSymbolsManager.findUndefined(ast),
      this.exportsManager,
      onlyAvailableExports,
    );
    this.suggestedImports.set(fileUri, missingImports);
    return missingImports;
  }

  handleUpdateForFile(update: ExportUpdateForFile) {
    const {componentDefinition, updateType, file, exports} = update;
    switch (updateType) {
      case 'setExports':
        if (componentDefinition != null) {
          this.definitionManager.addDefinition(componentDefinition);
        }
        this.exportsManager.setExportsForFile(file, exports);
        break;
      case 'deleteExports':
        this.exportsManager.clearExportsFromFile(file);
        break;
    }
  }

  findFilesWithSymbol(id: string): Array<JSExport> {
    return this.exportsManager.getExportsIndex().getExportsFromId(id);
  }

  getSuggestedImportsForRange(
    file: NuclideUri,
    range: IRange,
  ): Array<ImportSuggestion> {
    const suggestedImports = this.suggestedImports.get(file) || [];
    return suggestedImports.filter(suggestedImport => {
      // We use intersectsWith instead of containsRange to be compatible with clients
      // like VSCode which may request small ranges (the range of the current word).
      return Range.fromObject(lspRangeToAtomRange(range)).intersectsWith(
        babelLocationToAtomRange(suggestedImport.symbol.location),
        true,
      );
    });
  }
}

export function parseFile(code: string): ?Object {
  if (code.length >= LARGE_FILE_LIMIT) {
    return null;
  }
  try {
    return babylon.parse(code, babylonOptions);
  } catch (error) {
    // Encountered a parsing error. We don't log anything because this will be
    // quite common as this function can and will be called on every file edit.
    return null;
  }
}

function undefinedSymbolsToMissingImports(
  fileUri: NuclideUri,
  undefinedSymbols: Array<UndefinedSymbol>,
  exportsManager: ExportManager,
  onlyAvailableExports: boolean,
): Array<ImportSuggestion> {
  return undefinedSymbols
    .map(symbol => {
      const isValue = symbol.type === 'value';
      return {
        symbol,
        filesWithExport: exportsManager
          .getExportsIndex()
          .getExportsFromId(symbol.id)
          .filter(jsExport => {
            // Value imports cannot use type exports.
            if (isValue && jsExport.isTypeExport) {
              return false;
            }
            // No self imports.
            return jsExport.uri !== fileUri;
          }),
      };
    })
    .filter(
      result => !onlyAvailableExports || result.filesWithExport.length > 0,
    );
}

function checkEslint(ast: Object): boolean {
  return (
    IGNORE_ESLINT_DISABLED_FILES &&
    (ast.comments &&
      ast.comments.find(
        comment =>
          comment.type === 'CommentBlock' &&
          comment.value.trim() === 'eslint-disable',
      ))
  );
}
