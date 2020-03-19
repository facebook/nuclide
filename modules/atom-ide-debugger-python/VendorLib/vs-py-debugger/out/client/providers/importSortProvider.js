"use strict";
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
const os_1 = require("os");
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/process/types");
const types_4 = require("../common/types");
const misc_1 = require("../common/utils/misc");
const types_5 = require("../ioc/types");
const telemetry_1 = require("../telemetry");
const constants_2 = require("../telemetry/constants");
let SortImportsEditingProvider = class SortImportsEditingProvider {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.shell = serviceContainer.get(types_1.IApplicationShell);
        this.documentManager = serviceContainer.get(types_1.IDocumentManager);
        this.configurationService = serviceContainer.get(types_4.IConfigurationService);
        this.pythonExecutionFactory = serviceContainer.get(types_3.IPythonExecutionFactory);
        this.processServiceFactory = serviceContainer.get(types_3.IProcessServiceFactory);
        this.editorUtils = serviceContainer.get(types_4.IEditorUtils);
    }
    provideDocumentSortImportsEdits(uri, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const document = yield this.documentManager.openTextDocument(uri);
            if (!document) {
                return;
            }
            if (document.lineCount <= 1) {
                return;
            }
            // isort does have the ability to read from the process input stream and return the formatted code out of the output stream.
            // However they don't support returning the diff of the formatted text when reading data from the input stream.
            // Yes getting text formatted that way avoids having to create a temporary file, however the diffing will have
            // to be done here in node (extension), i.e. extension cpu, i.e. less responsive solution.
            const importScript = path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'sortImports.py');
            const fsService = this.serviceContainer.get(types_2.IFileSystem);
            const tmpFile = document.isDirty ? yield fsService.createTemporaryFile(path.extname(document.uri.fsPath)) : undefined;
            if (tmpFile) {
                yield fsService.writeFile(tmpFile.filePath, document.getText());
            }
            const settings = this.configurationService.getSettings(uri);
            const isort = settings.sortImports.path;
            const filePath = tmpFile ? tmpFile.filePath : document.uri.fsPath;
            const args = [filePath, '--diff'].concat(settings.sortImports.args);
            let diffPatch;
            if (token && token.isCancellationRequested) {
                return;
            }
            try {
                if (typeof isort === 'string' && isort.length > 0) {
                    // Lets just treat this as a standard tool.
                    const processService = yield this.processServiceFactory.create(document.uri);
                    diffPatch = (yield processService.exec(isort, args, { throwOnStdErr: true, token })).stdout;
                }
                else {
                    const processExeService = yield this.pythonExecutionFactory.create({ resource: document.uri });
                    diffPatch = (yield processExeService.exec([importScript].concat(args), { throwOnStdErr: true, token })).stdout;
                }
                return this.editorUtils.getWorkspaceEditsFromPatch(document.getText(), diffPatch, document.uri);
            }
            finally {
                if (tmpFile) {
                    tmpFile.dispose();
                }
            }
        });
    }
    registerCommands() {
        const cmdManager = this.serviceContainer.get(types_1.ICommandManager);
        const disposable = cmdManager.registerCommand(constants_1.Commands.Sort_Imports, this.sortImports, this);
        this.serviceContainer.get(types_4.IDisposableRegistry).push(disposable);
    }
    sortImports(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!uri) {
                const activeEditor = this.documentManager.activeTextEditor;
                if (!activeEditor || activeEditor.document.languageId !== constants_1.PYTHON_LANGUAGE) {
                    this.shell.showErrorMessage('Please open a Python file to sort the imports.').then(misc_1.noop, misc_1.noop);
                    return;
                }
                uri = activeEditor.document.uri;
            }
            const document = yield this.documentManager.openTextDocument(uri);
            if (document.lineCount <= 1) {
                return;
            }
            // Hack, if the document doesn't contain an empty line at the end, then add it
            // Else the library strips off the last line
            const lastLine = document.lineAt(document.lineCount - 1);
            if (lastLine.text.trim().length > 0) {
                const edit = new vscode_1.WorkspaceEdit();
                edit.insert(uri, lastLine.range.end, os_1.EOL);
                yield this.documentManager.applyEdit(edit);
            }
            try {
                const changes = yield this.provideDocumentSortImportsEdits(uri);
                if (!changes || changes.entries().length === 0) {
                    return;
                }
                yield this.documentManager.applyEdit(changes);
            }
            catch (error) {
                const message = typeof error === 'string' ? error : (error.message ? error.message : error);
                const outputChannel = this.serviceContainer.get(types_4.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
                outputChannel.appendLine(error);
                outputChannel.show();
                const logger = this.serviceContainer.get(types_4.ILogger);
                logger.logError(`Failed to format imports for '${uri.fsPath}'.`, error);
                this.shell.showErrorMessage(message).then(misc_1.noop, misc_1.noop);
            }
        });
    }
};
__decorate([
    telemetry_1.captureTelemetry(constants_2.FORMAT_SORT_IMPORTS)
], SortImportsEditingProvider.prototype, "provideDocumentSortImportsEdits", null);
SortImportsEditingProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_5.IServiceContainer))
], SortImportsEditingProvider);
exports.SortImportsEditingProvider = SortImportsEditingProvider;
//# sourceMappingURL=importSortProvider.js.map