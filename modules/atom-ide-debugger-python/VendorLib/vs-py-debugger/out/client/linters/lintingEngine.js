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
const inversify_1 = require("inversify");
const minimatch_1 = require("minimatch");
const path = require("path");
const vscode = require("vscode");
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/types");
const stopWatch_1 = require("../common/utils/stopWatch");
const types_4 = require("../ioc/types");
const provider_1 = require("../jupyter/provider");
const telemetry_1 = require("../telemetry");
const constants_2 = require("../telemetry/constants");
const types_5 = require("./types");
const PYTHON = { language: 'python' };
const lintSeverityToVSSeverity = new Map();
lintSeverityToVSSeverity.set(types_5.LintMessageSeverity.Error, vscode.DiagnosticSeverity.Error);
lintSeverityToVSSeverity.set(types_5.LintMessageSeverity.Hint, vscode.DiagnosticSeverity.Hint);
lintSeverityToVSSeverity.set(types_5.LintMessageSeverity.Information, vscode.DiagnosticSeverity.Information);
lintSeverityToVSSeverity.set(types_5.LintMessageSeverity.Warning, vscode.DiagnosticSeverity.Warning);
let LintingEngine = class LintingEngine {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.pendingLintings = new Map();
        this.documentHasJupyterCodeCells = (a, b) => Promise.resolve(false);
        this.documents = serviceContainer.get(types_1.IDocumentManager);
        this.workspace = serviceContainer.get(types_1.IWorkspaceService);
        this.configurationService = serviceContainer.get(types_3.IConfigurationService);
        this.outputChannel = serviceContainer.get(types_3.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
        this.linterManager = serviceContainer.get(types_5.ILinterManager);
        this.fileSystem = serviceContainer.get(types_2.IFileSystem);
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('python');
    }
    get diagnostics() {
        return this.diagnosticCollection;
    }
    clearDiagnostics(document) {
        if (this.diagnosticCollection.has(document.uri)) {
            this.diagnosticCollection.delete(document.uri);
        }
    }
    lintOpenPythonFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            this.diagnosticCollection.clear();
            const promises = this.documents.textDocuments.map((document) => __awaiter(this, void 0, void 0, function* () { return this.lintDocument(document, 'auto'); }));
            yield Promise.all(promises);
            return this.diagnosticCollection;
        });
    }
    lintDocument(document, trigger) {
        return __awaiter(this, void 0, void 0, function* () {
            this.diagnosticCollection.set(document.uri, []);
            // Check if we need to lint this document
            if (!(yield this.shouldLintDocument(document))) {
                return;
            }
            if (this.pendingLintings.has(document.uri.fsPath)) {
                this.pendingLintings.get(document.uri.fsPath).cancel();
                this.pendingLintings.delete(document.uri.fsPath);
            }
            const cancelToken = new vscode.CancellationTokenSource();
            cancelToken.token.onCancellationRequested(() => {
                if (this.pendingLintings.has(document.uri.fsPath)) {
                    this.pendingLintings.delete(document.uri.fsPath);
                }
            });
            this.pendingLintings.set(document.uri.fsPath, cancelToken);
            const activeLinters = yield this.linterManager.getActiveLinters(false, document.uri);
            const promises = activeLinters
                .map((info) => __awaiter(this, void 0, void 0, function* () {
                const stopWatch = new stopWatch_1.StopWatch();
                const linter = yield this.linterManager.createLinter(info.product, this.outputChannel, this.serviceContainer, document.uri);
                const promise = linter.lint(document, cancelToken.token);
                this.sendLinterRunTelemetry(info, document.uri, promise, stopWatch, trigger);
                return promise;
            }));
            const hasJupyterCodeCells = yield this.documentHasJupyterCodeCells(document, cancelToken.token);
            // linters will resolve asynchronously - keep a track of all
            // diagnostics reported as them come in.
            let diagnostics = [];
            const settings = this.configurationService.getSettings(document.uri);
            for (const p of promises) {
                const msgs = yield p;
                if (cancelToken.token.isCancellationRequested) {
                    break;
                }
                if (this.isDocumentOpen(document.uri)) {
                    // Build the message and suffix the message with the name of the linter used.
                    for (const m of msgs) {
                        // Ignore magic commands from jupyter.
                        if (hasJupyterCodeCells && document.lineAt(m.line - 1).text.trim().startsWith('%') &&
                            (m.code === constants_1.LinterErrors.pylint.InvalidSyntax ||
                                m.code === constants_1.LinterErrors.prospector.InvalidSyntax ||
                                m.code === constants_1.LinterErrors.flake8.InvalidSyntax)) {
                            continue;
                        }
                        diagnostics.push(this.createDiagnostics(m, document));
                    }
                    // Limit the number of messages to the max value.
                    diagnostics = diagnostics.filter((value, index) => index <= settings.linting.maxNumberOfProblems);
                }
            }
            // Set all diagnostics found in this pass, as this method always clears existing diagnostics.
            this.diagnosticCollection.set(document.uri, diagnostics);
        });
    }
    // tslint:disable-next-line:no-any
    linkJupyterExtension(jupyter) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!jupyter) {
                return;
            }
            if (!jupyter.isActive) {
                yield jupyter.activate();
            }
            // tslint:disable-next-line:no-unsafe-any
            jupyter.exports.registerLanguageProvider(PYTHON.language, new provider_1.JupyterProvider());
            // tslint:disable-next-line:no-unsafe-any
            this.documentHasJupyterCodeCells = jupyter.exports.hasCodeCells;
        });
    }
    sendLinterRunTelemetry(info, resource, promise, stopWatch, trigger) {
        const linterExecutablePathName = info.pathName(resource);
        const properties = {
            tool: info.id,
            hasCustomArgs: info.linterArgs(resource).length > 0,
            trigger,
            executableSpecified: linterExecutablePathName.length > 0
        };
        telemetry_1.sendTelemetryWhenDone(constants_2.LINTING, promise, stopWatch, properties);
    }
    isDocumentOpen(uri) {
        return this.documents.textDocuments.some(document => document.uri.fsPath === uri.fsPath);
    }
    createDiagnostics(message, document) {
        const position = new vscode.Position(message.line - 1, message.column);
        const range = new vscode.Range(position, position);
        const severity = lintSeverityToVSSeverity.get(message.severity);
        const diagnostic = new vscode.Diagnostic(range, message.message, severity);
        diagnostic.code = message.code;
        diagnostic.source = message.provider;
        return diagnostic;
    }
    shouldLintDocument(document) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.linterManager.isLintingEnabled(false, document.uri))) {
                this.diagnosticCollection.set(document.uri, []);
                return false;
            }
            if (document.languageId !== PYTHON.language) {
                return false;
            }
            const workspaceFolder = this.workspace.getWorkspaceFolder(document.uri);
            const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined;
            const relativeFileName = typeof workspaceRootPath === 'string' ? path.relative(workspaceRootPath, document.fileName) : document.fileName;
            const settings = this.configurationService.getSettings(document.uri);
            const ignoreMinmatches = settings.linting.ignorePatterns.map(pattern => new minimatch_1.Minimatch(pattern));
            if (ignoreMinmatches.some(matcher => matcher.match(document.fileName) || matcher.match(relativeFileName))) {
                return false;
            }
            if (document.uri.scheme !== 'file' || !document.uri.fsPath) {
                return false;
            }
            return this.fileSystem.fileExists(document.uri.fsPath);
        });
    }
};
LintingEngine = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_4.IServiceContainer))
], LintingEngine);
exports.LintingEngine = LintingEngine;
//# sourceMappingURL=lintingEngine.js.map