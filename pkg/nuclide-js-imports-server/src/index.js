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

import idx from 'idx';
import {createConnection} from 'vscode-languageserver';

import {StreamMessageWriter} from 'vscode-jsonrpc';
import {getLogger} from 'log4js';

import SafeStreamMessageReader from 'nuclide-commons/SafeStreamMessageReader';
import {AutoImportsManager} from './lib/AutoImportsManager';
import TextDocuments from '../../nuclide-lsp-implementation-common/TextDocuments';
import {ImportFormatter} from './lib/ImportFormatter';
import {Completions} from './Completions';
import {Diagnostics} from './Diagnostics';
import {Settings} from './Settings';
import {CodeActions} from './CodeActions';
import {CommandExecutor} from './CommandExecutor';

import initializeLogging from '../logging/initializeLogging';
import {getEslintGlobals, getConfigFromFlow} from './Config';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {WorkspaceSymbols} from './WorkspaceSymbols';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  CodeActionParams,
  Command,
  CompletionItem,
  ExecuteCommandParams,
  Hover,
  InitializeResult,
  SymbolInformation,
  TextDocumentPositionParams,
  WorkspaceSymbolParams,
} from '../../nuclide-vscode-language-service-rpc/lib/protocol';

const reader = new SafeStreamMessageReader(process.stdin);
const writer = new StreamMessageWriter(process.stdout);

const connection = createConnection(reader, writer);
initializeLogging(connection);

const logger = getLogger('nuclide-js-imports-server');

const documents: TextDocuments = new TextDocuments();

// This will be set based on initializationOptions.
const shouldProvideFlags = {
  diagnostics: false,
};

let autoImportsManager = new AutoImportsManager([]);
let importFormatter = new ImportFormatter([], false);
let completion = new Completions(
  autoImportsManager.getDefinitionManager(),
  documents,
  autoImportsManager,
  importFormatter,
);
let diagnostics = new Diagnostics(autoImportsManager, importFormatter);
let codeActions = new CodeActions(autoImportsManager, importFormatter);
let commandExecuter = new CommandExecutor(
  connection,
  autoImportsManager,
  importFormatter,
  documents,
);

connection.onInitialize(
  (params): InitializeResult => {
    const root = params.rootPath || process.cwd();
    const eslintGlobals = getEslintGlobals(root);
    const flowConfig = getConfigFromFlow(root);
    shouldProvideFlags.diagnostics = shouldProvideDiagnostics(params, root);
    importFormatter = new ImportFormatter(
      flowConfig.moduleDirs,
      shouldUseRequires(params, root),
    );
    autoImportsManager = new AutoImportsManager(
      eslintGlobals,
      params.initializationOptions
        ? {
            componentModulePathFilter:
              params.initializationOptions.componentModulePathFilter,
          }
        : undefined,
    );
    autoImportsManager.indexAndWatchDirectory(root);
    completion = new Completions(
      autoImportsManager.getDefinitionManager(),
      documents,
      autoImportsManager,
      importFormatter,
    );
    diagnostics = new Diagnostics(autoImportsManager, importFormatter);
    codeActions = new CodeActions(autoImportsManager, importFormatter);
    commandExecuter = new CommandExecutor(
      connection,
      autoImportsManager,
      importFormatter,
      documents,
    );
    return {
      capabilities: {
        textDocumentSync: documents.syncKind,
        completionProvider: {
          resolveProvider: false,
          triggerCharacters: getAllTriggerCharacters(),
        },
        codeActionProvider: true,
        executeCommandProvider: {
          commands: Array.from(Object.keys(CommandExecutor.COMMANDS)),
        },
        workspaceSymbolProvider: true,
        hoverProvider: true,
      },
    };
  },
);

documents.onDidOpenTextDocument(params => {
  try {
    const uri = nuclideUri.uriToNuclideUri(params.textDocument.uri);
    if (uri != null) {
      autoImportsManager.workerIndexFile(uri, params.textDocument.getText());
      findAndSendDiagnostics(params.textDocument.getText(), uri);
    }
  } catch (e) {
    logger.error(e);
  }
});

documents.onDidChangeContent(params => {
  try {
    const uri = nuclideUri.uriToNuclideUri(params.textDocument.uri);
    if (uri != null) {
      autoImportsManager.workerIndexFile(uri, params.textDocument.getText());
      findAndSendDiagnostics(params.textDocument.getText(), uri);
    }
  } catch (e) {
    logger.error(e);
  }
});

documents.onDidClose(params => {
  // Clear out diagnostics.
  connection.sendDiagnostics({uri: params.textDocument.uri, diagnostics: []});
});

function findAndSendDiagnostics(text: string, uri: NuclideUri): void {
  if (shouldProvideFlags.diagnostics) {
    const diagnosticsForFile = diagnostics.findDiagnosticsForFile(text, uri);
    connection.sendDiagnostics({
      uri: nuclideUri.nuclideUriToUri(uri),
      diagnostics: diagnosticsForFile,
    });
  }
}

connection.onHover(
  (hoverRequest: TextDocumentPositionParams): Hover => {
    return autoImportsManager
      .getDefinitionManager()
      .getHover(documents.get(hoverRequest.textDocument.uri), hoverRequest);
  },
);

// Code completion:
connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): Array<CompletionItem> => {
    const nuclideFormattedUri = nuclideUri.uriToNuclideUri(
      textDocumentPosition.textDocument.uri,
    );
    return nuclideFormattedUri != null
      ? completion.provideCompletions(textDocumentPosition, nuclideFormattedUri)
      : [];
  },
);

connection.onCodeAction(
  (codeActionParams: CodeActionParams): Array<Command> => {
    try {
      const uri = nuclideUri.uriToNuclideUri(codeActionParams.textDocument.uri);
      return uri != null
        ? codeActions.provideCodeActions(
            codeActionParams.context && codeActionParams.context.diagnostics,
            uri,
          )
        : [];
    } catch (error) {
      logger.error(error);
      return [];
    }
  },
);

connection.onExecuteCommand(
  (params: ExecuteCommandParams): any => {
    const {command, arguments: args} = params;
    logger.debug('Executing command', command, 'with args', args);
    return commandExecuter.executeCommand((command: any), args);
  },
);

connection.onWorkspaceSymbol(
  (params: WorkspaceSymbolParams): Array<SymbolInformation> => {
    return WorkspaceSymbols.getWorkspaceSymbols(autoImportsManager, params);
  },
);

documents.listen(connection);
connection.listen();

function getAllTriggerCharacters(): Array<string> {
  return [' ', '{', '}', '='];
}

function shouldProvideDiagnostics(params: Object, root: NuclideUri): boolean {
  const diagnosticsWhitelist =
    idx(params, _ => _.initializationOptions.diagnosticsWhitelist) || [];
  return diagnosticsWhitelist.length !== 0
    ? diagnosticsWhitelist.some(regex => root.match(new RegExp(regex)))
    : Settings.shouldProvideDiagnosticsDefault;
}

function shouldUseRequires(params: Object, root: NuclideUri): boolean {
  const requiresWhitelist =
    idx(params, _ => _.initializationOptions.requiresWhitelist) || [];
  return requiresWhitelist.some(regex => root.match(new RegExp(regex)));
}
