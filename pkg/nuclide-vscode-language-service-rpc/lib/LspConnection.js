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

import type {CancellationToken, MessageConnection} from 'vscode-jsonrpc';

import * as p from './protocol';
import {trackSampled} from 'nuclide-analytics';

const LSP_SAMPLE_RATE = 100;
// This is a strongly typed encapsulation over an underlying MessageConnection
// transport, which exposes only the LSP methods.
export class LspConnection {
  _jsonRpcConnection: MessageConnection;
  _lspLanguageServerName: string;
  _totalNumberOfPendingRequests: number = 0;
  _numberOfPendingRequestsPerRequestType: Map<string, number> = new Map();

  constructor(
    jsonRpcConnection: MessageConnection,
    lspLanguageServerName: string,
  ) {
    this._jsonRpcConnection = jsonRpcConnection;
    this._lspLanguageServerName = lspLanguageServerName;
  }

  dispose() {
    this._jsonRpcConnection.dispose();
  }

  onDispose(callback: () => void) {
    this._jsonRpcConnection.onDispose(callback);
  }

  incrementPendingRequests(requestName: string): number {
    return this._updateNumberOfPendingRequests(requestName, true);
  }

  decrementPendingRequests(requestName: string): number {
    return this._updateNumberOfPendingRequests(requestName, false);
  }

  _updateNumberOfPendingRequests(
    requestName: string,
    isIncrease: boolean,
  ): number {
    const changedNumber = isIncrease ? 1 : -1;
    this._totalNumberOfPendingRequests += changedNumber;
    let numberOfPendingRequest = 0;
    if (this._numberOfPendingRequestsPerRequestType.has(requestName)) {
      numberOfPendingRequest = this._numberOfPendingRequestsPerRequestType.get(
        requestName,
      );
    } else if (!isIncrease) {
      return 0;
    }

    numberOfPendingRequest += changedNumber;
    this._numberOfPendingRequestsPerRequestType.set(
      requestName,
      numberOfPendingRequest,
    );

    return numberOfPendingRequest;
  }

  sendAndTrackRequest<T>(
    requestName: string,
    params?: T,
    token?: CancellationToken,
  ): Promise<any> {
    const numberOfPendingRequest = this.incrementPendingRequests(requestName);

    trackSampled('lsp-rpc-connection-send-request', LSP_SAMPLE_RATE, {
      languageServerName: this._lspLanguageServerName,
      totalNumOfPendingRequests: this._totalNumberOfPendingRequests,
      requestName,
      numberOfPendingRequest,
    });
    const args = [requestName];
    if (params !== undefined) {
      args.push(params);
      if (token !== undefined) {
        args.push(token);
      }
    }

    return this._jsonRpcConnection.sendRequest(...args).then(result => {
      this.decrementPendingRequests(requestName);
      return result;
    });
  }

  initialize(params: p.InitializeParams): Promise<p.InitializeResult> {
    return this.sendAndTrackRequest('initialize', params);
  }

  shutdown(): Promise<void> {
    return this.sendAndTrackRequest('shutdown');
  }

  exit(): void {
    this._jsonRpcConnection.sendNotification('exit');
  }

  rage(): Promise<Array<p.RageItem>> {
    return this.sendAndTrackRequest('telemetry/rage');
  }

  showMessageNotification(params: p.ShowMessageParams): void {
    this._jsonRpcConnection.sendNotification('window/showMessage', params);
  }

  showMessageRequest(
    params: p.ShowMessageRequestParams,
  ): Promise<p.MessageActionItem> {
    return this.sendAndTrackRequest('window/showMessageRequest', params);
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

  willSaveWaitUntilTextDocument(
    params: p.WillSaveWaitUntilTextDocumentParams,
    token: CancellationToken,
  ): Promise<Array<p.TextEdit>> {
    return this.sendAndTrackRequest(
      'textDocument/willSaveWaitUntil',
      params,
      token,
    );
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
    token: CancellationToken,
  ): Promise<p.CompletionList | Array<p.CompletionItem>> {
    return this.sendAndTrackRequest('textDocument/completion', params, token);
  }

  completionItemResolve(params: p.CompletionItem): Promise<p.CompletionItem> {
    return this.sendAndTrackRequest('completionItem/resolve', params);
  }

  hover(
    params: p.TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<p.Hover> {
    return this.sendAndTrackRequest('textDocument/hover', params, token);
  }

  signatureHelp(
    params: p.TextDocumentPositionParams,
  ): Promise<?p.SignatureHelp> {
    return this.sendAndTrackRequest('textDocument/signatureHelp', params);
  }

  gotoDefinition(
    params: p.TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<p.LocationWithTitle | Array<p.LocationWithTitle>> {
    return this.sendAndTrackRequest('textDocument/definition', params, token);
  }

  findReferences(
    params: p.TextDocumentPositionParams,
  ): Promise<Array<p.Location>> {
    return this.sendAndTrackRequest('textDocument/references', params);
  }

  documentHighlight(
    params: p.TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<Array<p.DocumentHighlight>> {
    return this.sendAndTrackRequest(
      'textDocument/documentHighlight',
      params,
      token,
    );
  }

  documentSymbol(
    params: p.DocumentSymbolParams,
    token: CancellationToken,
  ): Promise<Array<p.SymbolInformation>> {
    return this.sendAndTrackRequest(
      'textDocument/documentSymbol',
      params,
      token,
    );
  }

  typeCoverage(params: p.TypeCoverageParams): Promise<p.TypeCoverageResult> {
    return this.sendAndTrackRequest('textDocument/typeCoverage', params);
  }

  toggleTypeCoverage(params: p.ToggleTypeCoverageParams): void {
    this.sendAndTrackRequest('workspace/toggleTypeCoverage', params);
  }

  workspaceSymbol(
    params: p.WorkspaceSymbolParams,
  ): Promise<Array<p.SymbolInformation>> {
    return this.sendAndTrackRequest('workspace/symbol', params);
  }

  executeCommand(params: p.ExecuteCommandParams): Promise<any> {
    return this.sendAndTrackRequest('workspace/executeCommand', params);
  }

  codeAction(params: p.CodeActionParams): Promise<Array<p.Command>> {
    return this.sendAndTrackRequest('textDocument/codeAction', params);
  }

  codeLens(params: p.CodeLensParams): Promise<Array<p.CodeLens>> {
    return this.sendAndTrackRequest('textDocument/codeLens', params);
  }

  codeLensResolve(params: p.CodeLens): Promise<p.CodeLens> {
    return this.sendAndTrackRequest('codeLens/resolve', params);
  }

  documentLink(params: p.DocumentLinkParams): Promise<?Array<p.DocumentLink>> {
    return this.sendAndTrackRequest('textDocument/documentLink', params);
  }

  documentLinkResolve(params: p.DocumentLink): Promise<p.DocumentLink> {
    return this.sendAndTrackRequest('documentLink/resolve', params);
  }

  documentFormatting(
    params: p.DocumentFormattingParams,
  ): Promise<Array<p.TextEdit>> {
    return this.sendAndTrackRequest('textDocument/formatting', params);
  }

  documentRangeFormatting(
    params: p.DocumentRangeFormattingParams,
  ): Promise<Array<p.TextEdit>> {
    return this.sendAndTrackRequest('textDocument/rangeFormatting', params);
  }

  documentOnTypeFormatting(
    params: p.DocumentOnTypeFormattingParams,
  ): Promise<Array<p.TextEdit>> {
    return this.sendAndTrackRequest('textDocument/onTypeFormatting', params);
  }

  rename(params: p.RenameParams): Promise<p.WorkspaceEdit> {
    return this.sendAndTrackRequest('textDocument/rename', params);
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
    callback: (
      p.ShowMessageRequestParams,
      CancellationToken,
    ) => Promise<?p.MessageActionItem>,
  ): void {
    this._jsonRpcConnection.onRequest(
      {method: 'window/showMessageRequest'},
      callback,
    );
  }

  onShowStatusRequest(
    callback: (
      p.ShowStatusParams,
      CancellationToken,
    ) => Promise<?p.MessageActionItem>,
  ): void {
    this._jsonRpcConnection.onRequest({method: 'window/showStatus'}, callback);
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

  onRegisterCapabilityRequest(callback: p.RegistrationParams => void): void {
    this._jsonRpcConnection.onRequest(
      {method: 'client/registerCapability'},
      callback,
    );
  }

  onUnregisterCapabilityRequest(
    callback: p.UnregistrationParams => void,
  ): void {
    this._jsonRpcConnection.onRequest(
      {method: 'client/unregisterCapability'},
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
