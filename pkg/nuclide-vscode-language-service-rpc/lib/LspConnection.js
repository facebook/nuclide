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

import type {CancellationToken, JsonRpcConnection} from './jsonrpc';

import * as p from './protocol';

// This is a strongly typed encapsulation over an underlying JsonRpcConnection
// transport, which exposes only the LSP methods.
export class LspConnection {
  _jsonRpcConnection: JsonRpcConnection;

  constructor(jsonRpcConnection: JsonRpcConnection) {
    this._jsonRpcConnection = jsonRpcConnection;
  }

  dispose() {
    this._jsonRpcConnection.dispose();
  }

  onDispose(callback: () => void) {
    this._jsonRpcConnection.onDispose(callback);
  }

  initialize(params: p.InitializeParams): Promise<p.InitializeResult> {
    return this._jsonRpcConnection.sendRequest('initialize', params);
  }

  shutdown(): Promise<void> {
    return this._jsonRpcConnection.sendRequest('shutdown');
  }

  exit(): void {
    this._jsonRpcConnection.sendNotification('exit');
  }

  rage(): Promise<Array<p.RageItem>> {
    return this._jsonRpcConnection.sendRequest('telemetry/rage');
  }

  showMessageNotification(params: p.ShowMessageParams): void {
    this._jsonRpcConnection.sendNotification('window/showMessage', params);
  }

  showMessageRequest(
    params: p.ShowMessageRequestParams,
  ): Promise<p.MessageActionItem> {
    return this._jsonRpcConnection.sendRequest(
      'window/showMessageRequest',
      params,
    );
  }

  logMessage(params: p.LogMessageParams): void {
    this._jsonRpcConnection.sendNotification('window/logMessage', params);
  }

  didChangeConfiguration(params: p.DidChangeConfigurationParams): void {
    this._jsonRpcConnection.sendNotification(
      'workspace/didChangeConfiguration',
      params,
    );
  }

  didOpenTextDocument(params: p.DidOpenTextDocumentParams): void {
    this._jsonRpcConnection.sendNotification('textDocument/didOpen', params);
  }

  didChangeTextDocument(params: p.DidChangeTextDocumentParams): void {
    this._jsonRpcConnection.sendNotification('textDocument/didChange', params);
  }

  didCloseTextDocument(params: p.DidCloseTextDocumentParams): void {
    this._jsonRpcConnection.sendNotification('textDocument/didClose', params);
  }

  didSaveTextDocument(params: p.DidSaveTextDocumentParams): void {
    this._jsonRpcConnection.sendNotification('textDocument/didSave', params);
  }

  didChangeWatchedFiles(params: p.DidChangeWatchedFilesParams): void {
    this._jsonRpcConnection.sendNotification(
      'workspace/didChangeWatchedFiles',
      params,
    );
  }

  publishDiagnostics(params: p.PublishDiagnosticsParams): void {
    this._jsonRpcConnection.sendNotification(
      'textDocument/publishDiagnostics',
      params,
    );
  }

  completion(
    params: p.TextDocumentPositionParams,
  ): Promise<p.CompletionList | Array<p.CompletionItem>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/completion',
      params,
    );
  }

  completionItemResolve(params: p.CompletionItem): Promise<p.CompletionItem> {
    return this._jsonRpcConnection.sendRequest(
      'completionItem/resolve',
      params,
    );
  }

  hover(
    params: p.TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<p.Hover> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/hover',
      params,
      token,
    );
  }

  signatureHelp(
    params: p.TextDocumentPositionParams,
  ): Promise<p.SignatureHelp> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/signatureHelp',
      params,
    );
  }

  gotoDefinition(
    params: p.TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<p.Location | Array<p.Location>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/definition',
      params,
      token,
    );
  }

  findReferences(
    params: p.TextDocumentPositionParams,
  ): Promise<Array<p.Location>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/references',
      params,
    );
  }

  documentHighlight(
    params: p.TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<Array<p.DocumentHighlight>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/documentHighlight',
      params,
      token,
    );
  }

  documentSymbol(
    params: p.DocumentSymbolParams,
  ): Promise<Array<p.SymbolInformation>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/documentSymbol',
      params,
    );
  }

  typeCoverage(params: p.TypeCoverageParams): Promise<p.TypeCoverageResult> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/typeCoverage',
      params,
    );
  }

  workspaceSymbol(
    params: p.WorkspaceSymbolParams,
  ): Promise<Array<p.SymbolInformation>> {
    return this._jsonRpcConnection.sendRequest('workspace/symbol', params);
  }

  executeCommand(params: p.ExecuteCommandParams): Promise<any> {
    return this._jsonRpcConnection.sendRequest(
      'workspace/executeCommand',
      params,
    );
  }

  codeAction(params: p.CodeActionParams): Promise<Array<p.Command>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/codeAction',
      params,
    );
  }

  codeLens(params: p.CodeLensParams): Promise<Array<p.CodeLens>> {
    return this._jsonRpcConnection.sendRequest('textDocument/codeLens', params);
  }

  codeLensResolve(params: p.CodeLens): Promise<p.CodeLens> {
    return this._jsonRpcConnection.sendRequest('codeLens/resolve', params);
  }

  documentLink(params: p.DocumentLinkParams): Promise<?Array<p.DocumentLink>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/documentLink',
      params,
    );
  }

  documentLinkResolve(params: p.DocumentLink): Promise<p.DocumentLink> {
    return this._jsonRpcConnection.sendRequest('documentLink/resolve', params);
  }

  documentFormatting(
    params: p.DocumentFormattingParams,
  ): Promise<Array<p.TextEdit>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/formatting',
      params,
    );
  }

  documentRangeFormatting(
    params: p.DocumentRangeFormattingParams,
  ): Promise<Array<p.TextEdit>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/rangeFormatting',
      params,
    );
  }

  documentOnTypeFormatting(
    params: p.DocumentOnTypeFormattingParams,
  ): Promise<Array<p.TextEdit>> {
    return this._jsonRpcConnection.sendRequest(
      'textDocument/onTypeFormatting',
      params,
    );
  }

  rename(params: p.RenameParams): Promise<p.WorkspaceEdit> {
    return this._jsonRpcConnection.sendRequest('textDocument/rename', params);
  }

  onDiagnosticsNotification(
    callback: p.PublishDiagnosticsParams => void,
  ): void {
    this._jsonRpcConnection.onNotification(
      {method: 'textDocument/publishDiagnostics'},
      callback,
    );
  }

  onTelemetryNotification(callback: any => void): void {
    this._jsonRpcConnection.onNotification(
      {method: 'telemetry/event'},
      callback,
    );
  }

  onLogMessageNotification(callback: p.LogMessageParams => void): void {
    this._jsonRpcConnection.onNotification(
      {method: 'window/logMessage'},
      callback,
    );
  }

  onShowMessageNotification(callback: p.ShowMessageParams => void): void {
    this._jsonRpcConnection.onNotification(
      {method: 'window/showMessage'},
      callback,
    );
  }

  onShowMessageRequest(
    callback: (p.ShowMessageRequestParams, CancellationToken) => Promise<any>,
  ): void {
    this._jsonRpcConnection.onRequest(
      {method: 'window/showMessageRequest'},
      callback,
    );
  }

  onApplyEditRequest(
    callback: (
      p.ApplyWorkspaceEditParams,
      CancellationToken,
    ) => Promise<p.ApplyWorkspaceEditResponse>,
  ): void {
    this._jsonRpcConnection.onRequest(
      {method: 'workspace/applyEdit'},
      callback,
    );
  }

  onProgressNotification(callback: p.ProgressParams => void): void {
    this._jsonRpcConnection.onNotification(
      {method: 'window/progress'},
      callback,
    );
  }

  onActionRequiredNotification(callback: p.ActionRequiredParams => void): void {
    this._jsonRpcConnection.onNotification(
      {method: 'window/actionRequired'},
      callback,
    );
  }
}
