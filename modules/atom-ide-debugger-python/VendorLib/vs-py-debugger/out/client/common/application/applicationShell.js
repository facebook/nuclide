// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-require-imports no-var-requires no-any unified-signatures
const opn = require('opn');
const inversify_1 = require("inversify");
const vscode_1 = require("vscode");
let ApplicationShell = class ApplicationShell {
    showInformationMessage(message, options, ...items) {
        return vscode_1.window.showInformationMessage(message, options, ...items);
    }
    showWarningMessage(message, options, ...items) {
        return vscode_1.window.showWarningMessage(message, options, ...items);
    }
    showErrorMessage(message, options, ...items) {
        return vscode_1.window.showErrorMessage(message, options, ...items);
    }
    showQuickPick(items, options, token) {
        return vscode_1.window.showQuickPick(items, options, token);
    }
    showOpenDialog(options) {
        return vscode_1.window.showOpenDialog(options);
    }
    showSaveDialog(options) {
        return vscode_1.window.showSaveDialog(options);
    }
    showInputBox(options, token) {
        return vscode_1.window.showInputBox(options, token);
    }
    openUrl(url) {
        opn(url);
    }
    setStatusBarMessage(text, arg) {
        return vscode_1.window.setStatusBarMessage(text, arg);
    }
    createStatusBarItem(alignment, priority) {
        return vscode_1.window.createStatusBarItem(alignment, priority);
    }
    showWorkspaceFolderPick(options) {
        return vscode_1.window.showWorkspaceFolderPick(options);
    }
    withProgress(options, task) {
        return vscode_1.window.withProgress(options, task);
    }
};
ApplicationShell = __decorate([
    inversify_1.injectable()
], ApplicationShell);
exports.ApplicationShell = ApplicationShell;
//# sourceMappingURL=applicationShell.js.map