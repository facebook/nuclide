"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../common/application/types");
const constants_1 = require("../../common/constants");
require("../../common/extensions");
const types_2 = require("../../common/process/types");
const types_3 = require("../../common/types");
const types_4 = require("../../ioc/types");
let CodeExecutionHelper = class CodeExecutionHelper {
    constructor(serviceContainer) {
        this.documentManager = serviceContainer.get(types_1.IDocumentManager);
        this.applicationShell = serviceContainer.get(types_1.IApplicationShell);
        this.processServiceFactory = serviceContainer.get(types_2.IProcessServiceFactory);
        this.configurationService = serviceContainer.get(types_3.IConfigurationService);
    }
    normalizeLines(code, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (code.trim().length === 0) {
                    return '';
                }
                const pythonPath = this.configurationService.getSettings(resource).pythonPath;
                const args = [path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'normalizeForInterpreter.py'), code];
                const processService = yield this.processServiceFactory.create(resource);
                const proc = yield processService.exec(pythonPath, args, { throwOnStdErr: true });
                return proc.stdout;
            }
            catch (ex) {
                console.error(ex, 'Python: Failed to normalize code for execution in terminal');
                return code;
            }
        });
    }
    getFileToExecute() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeEditor = this.documentManager.activeTextEditor;
            if (!activeEditor) {
                this.applicationShell.showErrorMessage('No open file to run in terminal');
                return;
            }
            if (activeEditor.document.isUntitled) {
                this.applicationShell.showErrorMessage('The active file needs to be saved before it can be run');
                return;
            }
            if (activeEditor.document.languageId !== constants_1.PYTHON_LANGUAGE) {
                this.applicationShell.showErrorMessage('The active file is not a Python source file');
                return;
            }
            if (activeEditor.document.isDirty) {
                yield activeEditor.document.save();
            }
            return activeEditor.document.uri;
        });
    }
    getSelectedTextToExecute(textEditor) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!textEditor) {
                return;
            }
            const selection = textEditor.selection;
            let code;
            if (selection.isEmpty) {
                code = textEditor.document.lineAt(selection.start.line).text;
            }
            else {
                const textRange = new vscode_1.Range(selection.start, selection.end);
                code = textEditor.document.getText(textRange);
            }
            return code;
        });
    }
    saveFileIfDirty(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const docs = this.documentManager.textDocuments.filter(d => d.uri.path === file.path);
            if (docs.length === 1 && docs[0].isDirty) {
                yield docs[0].save();
            }
        });
    }
};
CodeExecutionHelper = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_4.IServiceContainer))
], CodeExecutionHelper);
exports.CodeExecutionHelper = CodeExecutionHelper;
//# sourceMappingURL=helper.js.map