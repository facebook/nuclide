"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const vscode = require("vscode");
const types_1 = require("../common/application/types");
const constants_1 = require("../common/constants");
require("../common/extensions");
const helpers_1 = require("../common/helpers");
const types_2 = require("../common/process/types");
const types_3 = require("../common/types");
const editor_1 = require("./../common/editor");
const types_4 = require("./types");
class BaseFormatter {
    constructor(Id, product, serviceContainer) {
        this.Id = Id;
        this.product = product;
        this.serviceContainer = serviceContainer;
        this.outputChannel = serviceContainer.get(types_3.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
        this.helper = serviceContainer.get(types_4.IFormatterHelper);
        this.workspace = serviceContainer.get(types_1.IWorkspaceService);
    }
    getDocumentPath(document, fallbackPath) {
        if (path.basename(document.uri.fsPath) === document.uri.fsPath) {
            return fallbackPath;
        }
        return path.dirname(document.fileName);
    }
    getWorkspaceUri(document) {
        const workspaceFolder = this.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            return workspaceFolder.uri;
        }
        const folders = this.workspace.workspaceFolders;
        if (Array.isArray(folders) && folders.length > 0) {
            return folders[0].uri;
        }
        return vscode.Uri.file(__dirname);
    }
    provideDocumentFormattingEdits(document, options, token, args, cwd) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof cwd !== 'string' || cwd.length === 0) {
                cwd = this.getWorkspaceUri(document).fsPath;
            }
            // autopep8 and yapf have the ability to read from the process input stream and return the formatted code out of the output stream.
            // However they don't support returning the diff of the formatted text when reading data from the input stream.
            // Yet getting text formatted that way avoids having to create a temporary file, however the diffing will have
            // to be done here in node (extension), i.e. extension CPU, i.e. less responsive solution.
            const tempFile = yield this.createTempFile(document);
            if (this.checkCancellation(document.fileName, tempFile, token)) {
                return [];
            }
            const executionInfo = this.helper.getExecutionInfo(this.product, args, document.uri);
            executionInfo.args.push(tempFile);
            const pythonToolsExecutionService = this.serviceContainer.get(types_2.IPythonToolExecutionService);
            const promise = pythonToolsExecutionService.exec(executionInfo, { cwd, throwOnStdErr: false, token }, document.uri)
                .then(output => output.stdout)
                .then(data => {
                if (this.checkCancellation(document.fileName, tempFile, token)) {
                    return [];
                }
                return editor_1.getTextEditsFromPatch(document.getText(), data);
            })
                .catch(error => {
                if (this.checkCancellation(document.fileName, tempFile, token)) {
                    return [];
                }
                // tslint:disable-next-line:no-empty
                this.handleError(this.Id, error, document.uri).catch(() => { });
                return [];
            })
                .then(edits => {
                this.deleteTempFile(document.fileName, tempFile).ignoreErrors();
                return edits;
            });
            vscode.window.setStatusBarMessage(`Formatting with ${this.Id}`, promise);
            return promise;
        });
    }
    handleError(expectedFileName, error, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            let customError = `Formatting with ${this.Id} failed.`;
            if (helpers_1.isNotInstalledError(error)) {
                const installer = this.serviceContainer.get(types_3.IInstaller);
                const isInstalled = yield installer.isInstalled(this.product, resource);
                if (!isInstalled) {
                    customError += `\nYou could either install the '${this.Id}' formatter, turn it off or use another formatter.`;
                    installer.promptToInstall(this.product, resource).catch(ex => console.error('Python Extension: promptToInstall', ex));
                }
            }
            this.outputChannel.appendLine(`\n${customError}\n${error}`);
        });
    }
    createTempFile(document) {
        return __awaiter(this, void 0, void 0, function* () {
            return document.isDirty
                ? editor_1.getTempFileWithDocumentContents(document)
                : document.fileName;
        });
    }
    deleteTempFile(originalFile, tempFile) {
        if (originalFile !== tempFile) {
            return fs.unlink(tempFile);
        }
        return Promise.resolve();
    }
    checkCancellation(originalFile, tempFile, token) {
        if (token && token.isCancellationRequested) {
            this.deleteTempFile(originalFile, tempFile).ignoreErrors();
            return true;
        }
        return false;
    }
}
exports.BaseFormatter = BaseFormatter;
//# sourceMappingURL=baseFormatter.js.map