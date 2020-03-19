// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../common/application/types");
const configSettingMonitor_1 = require("../common/configSettingMonitor");
const constants_1 = require("../common/constants");
require("../common/extensions");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/types");
const contracts_1 = require("../interpreter/contracts");
const types_4 = require("../linters/types");
class LinterProvider {
    constructor(context, serviceContainer) {
        this.context = context;
        this.disposables = [];
        this.fs = serviceContainer.get(types_2.IFileSystem);
        this.engine = serviceContainer.get(types_4.ILintingEngine);
        this.linterManager = serviceContainer.get(types_4.ILinterManager);
        this.interpreterService = serviceContainer.get(contracts_1.IInterpreterService);
        this.documents = serviceContainer.get(types_1.IDocumentManager);
        this.configuration = serviceContainer.get(types_3.IConfigurationService);
        this.disposables.push(this.interpreterService.onDidChangeInterpreter(() => this.engine.lintOpenPythonFiles()));
        this.documents.onDidOpenTextDocument(e => this.onDocumentOpened(e), this.context.subscriptions);
        this.documents.onDidCloseTextDocument(e => this.onDocumentClosed(e), this.context.subscriptions);
        this.documents.onDidSaveTextDocument(e => this.onDocumentSaved(e), this.context.subscriptions);
        this.configMonitor = new configSettingMonitor_1.ConfigSettingMonitor('linting');
        this.configMonitor.on('change', this.lintSettingsChangedHandler.bind(this));
        // On workspace reopen we don't get `onDocumentOpened` since it is first opened
        // and then the extension is activated. So schedule linting pass now.
        if (!constants_1.isTestExecution()) {
            setTimeout(() => this.engine.lintOpenPythonFiles().ignoreErrors(), 1200);
        }
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.configMonitor.dispose();
    }
    isDocumentOpen(uri) {
        return this.documents.textDocuments.some(document => this.fs.arePathsSame(document.uri.fsPath, uri.fsPath));
    }
    lintSettingsChangedHandler(configTarget, wkspaceOrFolder) {
        if (configTarget === vscode_1.ConfigurationTarget.Workspace) {
            this.engine.lintOpenPythonFiles().ignoreErrors();
            return;
        }
        // Look for python files that belong to the specified workspace folder.
        vscode_1.workspace.textDocuments.forEach((document) => __awaiter(this, void 0, void 0, function* () {
            const wkspaceFolder = vscode_1.workspace.getWorkspaceFolder(document.uri);
            if (wkspaceFolder && wkspaceFolder.uri.fsPath === wkspaceOrFolder.fsPath) {
                this.engine.lintDocument(document, 'auto').ignoreErrors();
            }
        }));
    }
    onDocumentOpened(document) {
        this.engine.lintDocument(document, 'auto').ignoreErrors();
    }
    onDocumentSaved(document) {
        const settings = this.configuration.getSettings(document.uri);
        if (document.languageId === 'python' && settings.linting.enabled && settings.linting.lintOnSave) {
            this.engine.lintDocument(document, 'save').ignoreErrors();
            return;
        }
        this.linterManager.getActiveLinters(false, document.uri)
            .then((linters) => {
            const fileName = path.basename(document.uri.fsPath).toLowerCase();
            const watchers = linters.filter((info) => info.configFileNames.indexOf(fileName) >= 0);
            if (watchers.length > 0) {
                setTimeout(() => this.engine.lintOpenPythonFiles(), 1000);
            }
        }).ignoreErrors();
    }
    onDocumentClosed(document) {
        if (!document || !document.fileName || !document.uri) {
            return;
        }
        // Check if this document is still open as a duplicate editor.
        if (!this.isDocumentOpen(document.uri)) {
            this.engine.clearDiagnostics(document);
        }
    }
}
exports.LinterProvider = LinterProvider;
//# sourceMappingURL=linterProvider.js.map