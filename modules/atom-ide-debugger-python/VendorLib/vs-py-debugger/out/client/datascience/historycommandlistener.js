// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../common/extensions");
const inversify_1 = require("inversify");
const vscode_1 = require("vscode");
const types_1 = require("../common/application/types");
const types_2 = require("../common/types");
const localize = require("../common/utils/localize");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../unittests/common/constants");
const constants_2 = require("./constants");
const types_3 = require("./types");
let HistoryCommandListener = class HistoryCommandListener {
    constructor(disposableRegistry, historyProvider, jupyterImporter, documentManager, applicationShell, logger, configuration, statusProvider) {
        this.disposableRegistry = disposableRegistry;
        this.historyProvider = historyProvider;
        this.jupyterImporter = jupyterImporter;
        this.documentManager = documentManager;
        this.applicationShell = applicationShell;
        this.logger = logger;
        this.configuration = configuration;
        this.statusProvider = statusProvider;
        this.canImportFromOpenedFile = () => {
            const settings = this.configuration.getSettings();
            return settings && (!settings.datascience || settings.datascience.allowImportFromNotebook);
        };
        this.disableImportOnOpenedFile = () => {
            const settings = this.configuration.getSettings();
            if (settings && settings.datascience) {
                settings.datascience.allowImportFromNotebook = false;
            }
        };
        this.onOpenedDocument = (document) => __awaiter(this, void 0, void 0, function* () {
            if (document.fileName.endsWith('.ipynb') && this.canImportFromOpenedFile()) {
                const yes = localize.DataScience.notebookCheckForImportYes();
                const no = localize.DataScience.notebookCheckForImportNo();
                const dontAskAgain = localize.DataScience.notebookCheckForImportDontAskAgain();
                const answer = yield this.applicationShell.showInformationMessage(localize.DataScience.notebookCheckForImportTitle(), yes, no, dontAskAgain);
                try {
                    if (answer === yes) {
                        yield this.importNotebookOnFile(document.fileName);
                    }
                    else if (answer === dontAskAgain) {
                        this.disableImportOnOpenedFile();
                    }
                }
                catch (err) {
                    this.applicationShell.showErrorMessage(err);
                }
            }
        });
        this.setImportStatus = (file) => {
            const formatString = localize.DataScience.importingFormat();
            const message = formatString.format(file);
            return this.statusProvider.set(message, null);
        };
        this.viewDocument = (contents) => __awaiter(this, void 0, void 0, function* () {
            const doc = yield this.documentManager.openTextDocument({ language: 'python', content: contents });
            const editor = yield this.documentManager.showTextDocument(doc, vscode_1.ViewColumn.One);
            // Edit the document so that it is dirty (add a space at the end)
            editor.edit((editBuilder) => {
                editBuilder.insert(new vscode_1.Position(editor.document.lineCount, 0), '\n');
            });
        });
        // Listen to document open commands. We want to ask the user if they want to import.
        const disposable = this.documentManager.onDidOpenTextDocument(this.onOpenedDocument);
        this.disposableRegistry.push(disposable);
    }
    register(commandManager) {
        let disposable = commandManager.registerCommand(constants_2.Commands.ShowHistoryPane, () => this.showHistoryPane());
        this.disposableRegistry.push(disposable);
        disposable = commandManager.registerCommand(constants_2.Commands.ImportNotebook, (file, cmdSource = constants_1.CommandSource.commandPalette) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (file) {
                    yield this.importNotebookOnFile(file.fsPath);
                }
                else {
                    yield this.importNotebook();
                }
            }
            catch (err) {
                if (err.message) {
                    this.logger.logError(err.message);
                    this.applicationShell.showErrorMessage(err.message);
                }
                else {
                    this.logger.logError(err.toString());
                    this.applicationShell.showErrorMessage(err.toString());
                }
            }
        }));
        this.disposableRegistry.push(disposable);
    }
    showHistoryPane() {
        const active = this.historyProvider.active;
        return active.show();
    }
    importNotebook() {
        return __awaiter(this, void 0, void 0, function* () {
            const filtersKey = localize.DataScience.importDialogFilter();
            const filtersObject = {};
            filtersObject[filtersKey] = ['ipynb'];
            const uris = yield this.applicationShell.showOpenDialog({
                openLabel: localize.DataScience.importDialogTitle(),
                filters: filtersObject
            });
            if (uris && uris.length > 0) {
                const status = this.setImportStatus(uris[0].fsPath);
                try {
                    const contents = yield this.jupyterImporter.importFromFile(uris[0].fsPath);
                    yield this.viewDocument(contents);
                }
                catch (err) {
                    throw err;
                }
                finally {
                    status.dispose();
                }
            }
        });
    }
    importNotebookOnFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (file && file.length > 0) {
                const status = this.setImportStatus(file);
                try {
                    const contents = yield this.jupyterImporter.importFromFile(file);
                    yield this.viewDocument(contents);
                }
                catch (err) {
                    throw err;
                }
                finally {
                    status.dispose();
                }
            }
        });
    }
};
__decorate([
    telemetry_1.captureTelemetry(constants_2.Telemetry.ShowHistoryPane, {}, false)
], HistoryCommandListener.prototype, "showHistoryPane", null);
__decorate([
    telemetry_1.captureTelemetry(constants_2.Telemetry.ImportNotebook, { scope: 'command' }, false)
], HistoryCommandListener.prototype, "importNotebook", null);
__decorate([
    telemetry_1.captureTelemetry(constants_2.Telemetry.ImportNotebook, { scope: 'file' }, false)
], HistoryCommandListener.prototype, "importNotebookOnFile", null);
HistoryCommandListener = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IDisposableRegistry)),
    __param(1, inversify_1.inject(types_3.IHistoryProvider)),
    __param(2, inversify_1.inject(types_3.INotebookImporter)),
    __param(3, inversify_1.inject(types_1.IDocumentManager)),
    __param(4, inversify_1.inject(types_1.IApplicationShell)),
    __param(5, inversify_1.inject(types_2.ILogger)),
    __param(6, inversify_1.inject(types_2.IConfigurationService)),
    __param(7, inversify_1.inject(types_3.IStatusProvider))
], HistoryCommandListener);
exports.HistoryCommandListener = HistoryCommandListener;
//# sourceMappingURL=historycommandlistener.js.map