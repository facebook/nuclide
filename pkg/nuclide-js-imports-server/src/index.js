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
import {
  createConnection,
  CompletionItem,
  TextDocumentPositionParams,
  IConnection,
  InitializeResult,
  Command,
  CodeActionParams,
  ExecuteCommandParams,
} from 'vscode-languageserver';

import {StreamMessageReader, StreamMessageWriter} from 'vscode-jsonrpc';
import {getLogger} from 'log4js';

import {AutoImportsManager} from './lib/AutoImportsManager';
import TextDocuments from './TextDocuments';
import {ImportFormatter} from './lib/ImportFormatter';
import {Completions} from './Completions';
import {Diagnostics} from './Diagnostics';
import {Settings} from './Settings';
import {CodeActions} from './CodeActions';
import {CommandExecutor} from './CommandExecutor';

import initializeLogging from '../logging/initializeLogging';
import {getEslintEnvs, getConfigFromFlow} from './getConfig';
import nuclideUri from 'nuclide-commons/nuclideUri';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

const reader = new StreamMessageReader(process.stdin);
const writer = new StreamMessageWriter(process.stdout);

const connection: IConnection = createConnection(reader, writer);
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
  documents,
  autoImportsManager,
  importFormatter,
);
let diagnostics = new Diagnostics(autoImportsManager, importFormatter);
let codeActions = new CodeActions(autoImportsManager, importFormatter);
let commandExecuter = new CommandExecutor(
  connection,
  importFormatter,
  documents,
);

connection.onInitialize((params): InitializeResult => {
  const root = params.rootPath || process.cwd();
  logger.debug('Server initialized.');
  const envs = getEslintEnvs(root);
  const flowConfig = getConfigFromFlow(root);
  shouldProvideFlags.diagnostics = shouldProvideDiagnostics(params, root);
  importFormatter = new ImportFormatter(
    flowConfig.moduleDirs,
    shouldUseRequires(params, root),
  );
  autoImportsManager = new AutoImportsManager(envs);
  autoImportsManager.indexAndWatchDirectory(root);
  completion = new Completions(documents, autoImportsManager, importFormatter);
  diagnostics = new Diagnostics(autoImportsManager, importFormatter);
  codeActions = new CodeActions(autoImportsManager, importFormatter);
  commandExecuter = new CommandExecutor(connection, importFormatter, documents);
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: getAllTriggerCharacters(),
      },
      codeActionProvider: true,
      executeCommandProvider: Array.from(Object.keys(CommandExecutor.COMMANDS)),
    },
  };
});

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
    const uri = nuclideUri.uriToNuclideUri(params.document.uri);
    if (uri != null) {
      autoImportsManager.workerIndexFile(uri, params.document.getText());
      findAndSendDiagnostics(params.document.getText(), uri);
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

connection.onCodeAction((codeActionParams: CodeActionParams): Array<
  Command,
> => {
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
});

connection.onExecuteCommand((params: ExecuteCommandParams): any => {
  const {command, arguments: args} = params;
  logger.debug('Executing command', command, 'with args', args);
  commandExecuter.executeCommand(command, args);
});

documents.listen(connection);
connection.listen();

function getAllTriggerCharacters(): Array<string> {
  const characters = [' ', '}', '='];
  // Add all the characters from A-z
  for (let char = 'A'.charCodeAt(0); char <= 'z'.charCodeAt(0); char++) {
    characters.push(String.fromCharCode(char));
  }
  return characters;
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
