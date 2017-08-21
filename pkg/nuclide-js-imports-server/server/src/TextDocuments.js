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

import type {
  // flowlint-next-line untyped-type-import:off
  DidChangeTextDocumentParams,
  // flowlint-next-line untyped-type-import:off
  DidCloseTextDocumentParams,
  // flowlint-next-line untyped-type-import:off
  DidOpenTextDocumentParams,
  // flowlint-next-line untyped-type-import:off
  DidSaveTextDocumentParams,
  // flowlint-next-line untyped-type-import:off
  IConnection,
  // flowlint-next-line untyped-type-import:off
  TextDocumentSyncKindType,
} from 'vscode-languageserver';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  // flowlint-next-line untyped-type-import:off
  ITextDocumentItem,
  // flowlint-next-line untyped-type-import:off
  TextDocumentChangeEvent,
} from 'vscode-languageserver-types';

import invariant from 'assert';
import TextDocument from './TextDocument';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Emitter} from 'event-kit';
import {TextDocumentSyncKind} from 'vscode-languageserver';

function textDocumentFromLSPTextDocument(textDocument: ITextDocumentItem) {
  return new TextDocument(
    textDocument.uri,
    textDocument.languageId,
    textDocument.version,
    textDocument.text,
  );
}

export default class TextDocuments {
  _disposables = new UniversalDisposable();
  _documents: Map<string, TextDocument> = new Map();
  _emitter: Emitter = new Emitter();

  constructor() {
    this._disposables.add(this._emitter);
  }

  dispose(): void {
    this._disposables.dispose();
  }

  get disposed(): boolean {
    return this._disposables.disposed;
  }

  get syncKind(): TextDocumentSyncKindType {
    return TextDocumentSyncKind.Incremental;
  }

  get(uri: string): TextDocument {
    const document = this._documents.get(uri);

    invariant(
      document != null,
      `TextDocuments: asked for document with uri ${uri}, but no buffer was loaded`,
    );
    return document;
  }

  listen(connection: IConnection): void {
    connection.onDidOpenTextDocument((e: DidOpenTextDocumentParams) => {
      const {textDocument} = e;
      const document = textDocumentFromLSPTextDocument(textDocument);
      this.addDocument(textDocument.uri, document);
    });

    connection.onDidChangeTextDocument((e: DidChangeTextDocumentParams) => {
      const {contentChanges, textDocument} = e;
      const document = this.get(textDocument.uri);
      document.updateMany(contentChanges, textDocument.version);
    });

    connection.onDidCloseTextDocument((e: DidCloseTextDocumentParams) => {
      this.removeDocument(e.textDocument.uri);
    });

    connection.onDidSaveTextDocument((e: DidSaveTextDocumentParams) => {
      const document = this.get(e.textDocument.uri);
      document.save(e.textDocument.version, e.text);
    });
  }

  addDocument(uri: NuclideUri, document: TextDocument) {
    this._documents.set(uri, document);
    this._disposables.add(document);
    this._emitter.emit('didOpenTextDocument', {textDocument: document});
    document.onDidStopChanging(this._handleDidStopChanging);
    document.onDidSave(this._handleDidSave);
  }

  removeDocument(uri: NuclideUri) {
    const document = this.get(uri);
    this._emitter.emit('didClose', {textDocument: document});
    this._disposables.remove(document);
    this._documents.delete(uri);
    document.dispose();
  }

  all(): Array<TextDocument> {
    return Array.from(this._documents.values());
  }

  onDidChangeContent(handler: (e: TextDocumentChangeEvent) => void): void {
    this._emitter.on('didChangeContent', handler);
  }

  onDidSave(handler: (e: TextDocumentChangeEvent) => void): void {
    this._emitter.on('didSave', handler);
  }

  onDidOpenTextDocument(handler: (e: TextDocumentChangeEvent) => void): void {
    this._emitter.on('didOpenTextDocument', handler);
  }

  onDidClose(handler: (e: TextDocumentChangeEvent) => void): void {
    this._emitter.on('didClose', handler);
  }

  _handleDidStopChanging = (document: TextDocument) => {
    this._emitter.emit('didChangeContent', {document});
  };

  _handleDidSave = (document: TextDocument) => {
    this._emitter.emit('didSave', {document});
  };
}
