"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any unified-signatures
const inversify_1 = require("inversify");
const vscode_1 = require("vscode");
let DocumentManager = class DocumentManager {
    get textDocuments() {
        return vscode_1.workspace.textDocuments;
    }
    get activeTextEditor() {
        return vscode_1.window.activeTextEditor;
    }
    get visibleTextEditors() {
        return vscode_1.window.visibleTextEditors;
    }
    get onDidChangeActiveTextEditor() {
        return vscode_1.window.onDidChangeActiveTextEditor;
    }
    get onDidChangeVisibleTextEditors() {
        return vscode_1.window.onDidChangeVisibleTextEditors;
    }
    get onDidChangeTextEditorSelection() {
        return vscode_1.window.onDidChangeTextEditorSelection;
    }
    get onDidChangeTextEditorOptions() {
        return vscode_1.window.onDidChangeTextEditorOptions;
    }
    get onDidChangeTextEditorViewColumn() {
        return vscode_1.window.onDidChangeTextEditorViewColumn;
    }
    get onDidOpenTextDocument() {
        return vscode_1.workspace.onDidOpenTextDocument;
    }
    get onDidCloseTextDocument() {
        return vscode_1.workspace.onDidCloseTextDocument;
    }
    get onDidSaveTextDocument() {
        return vscode_1.workspace.onDidSaveTextDocument;
    }
    showTextDocument(uri, options, preserveFocus) {
        return vscode_1.window.showTextDocument(uri, options, preserveFocus);
    }
    openTextDocument(arg) {
        return vscode_1.workspace.openTextDocument(arg);
    }
    applyEdit(edit) {
        return vscode_1.workspace.applyEdit(edit);
    }
};
DocumentManager = __decorate([
    inversify_1.injectable()
], DocumentManager);
exports.DocumentManager = DocumentManager;
//# sourceMappingURL=documentManager.js.map