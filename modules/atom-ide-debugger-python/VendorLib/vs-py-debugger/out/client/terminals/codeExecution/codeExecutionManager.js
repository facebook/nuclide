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
const vscode_1 = require("vscode");
const types_1 = require("../../common/application/types");
const constants_1 = require("../../common/constants");
const types_2 = require("../../common/types");
const types_3 = require("../../ioc/types");
const telemetry_1 = require("../../telemetry");
const constants_2 = require("../../telemetry/constants");
const types_4 = require("../../terminals/types");
let CodeExecutionManager = class CodeExecutionManager {
    constructor(commandManager, documentManager, disposableRegistry, serviceContainer) {
        this.commandManager = commandManager;
        this.documentManager = documentManager;
        this.disposableRegistry = disposableRegistry;
        this.serviceContainer = serviceContainer;
    }
    registerCommands() {
        this.disposableRegistry.push(this.commandManager.registerCommand(constants_1.Commands.Exec_In_Terminal, this.executeFileInterTerminal.bind(this)));
        this.disposableRegistry.push(this.commandManager.registerCommand(constants_1.Commands.Exec_Selection_In_Terminal, this.executeSelectionInTerminal.bind(this)));
        this.disposableRegistry.push(this.commandManager.registerCommand(constants_1.Commands.Exec_Selection_In_Django_Shell, this.executeSelectionInDjangoShell.bind(this)));
    }
    executeFileInterTerminal(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const codeExecutionHelper = this.serviceContainer.get(types_4.ICodeExecutionHelper);
            file = file instanceof vscode_1.Uri ? file : undefined;
            const fileToExecute = file ? file : yield codeExecutionHelper.getFileToExecute();
            if (!fileToExecute) {
                return;
            }
            yield codeExecutionHelper.saveFileIfDirty(fileToExecute);
            const executionService = this.serviceContainer.get(types_4.ICodeExecutionService, 'standard');
            yield executionService.executeFile(fileToExecute);
        });
    }
    executeSelectionInTerminal() {
        return __awaiter(this, void 0, void 0, function* () {
            const executionService = this.serviceContainer.get(types_4.ICodeExecutionService, 'standard');
            yield this.executeSelection(executionService);
        });
    }
    executeSelectionInDjangoShell() {
        return __awaiter(this, void 0, void 0, function* () {
            const executionService = this.serviceContainer.get(types_4.ICodeExecutionService, 'djangoShell');
            yield this.executeSelection(executionService);
        });
    }
    executeSelection(executionService) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeEditor = this.documentManager.activeTextEditor;
            if (!activeEditor) {
                return;
            }
            const codeExecutionHelper = this.serviceContainer.get(types_4.ICodeExecutionHelper);
            const codeToExecute = yield codeExecutionHelper.getSelectedTextToExecute(activeEditor);
            const normalizedCode = yield codeExecutionHelper.normalizeLines(codeToExecute);
            if (!normalizedCode || normalizedCode.trim().length === 0) {
                return;
            }
            yield executionService.execute(normalizedCode, activeEditor.document.uri);
        });
    }
};
__decorate([
    telemetry_1.captureTelemetry(constants_2.EXECUTION_CODE, { scope: 'file' }, false)
], CodeExecutionManager.prototype, "executeFileInterTerminal", null);
__decorate([
    telemetry_1.captureTelemetry(constants_2.EXECUTION_CODE, { scope: 'selection' }, false)
], CodeExecutionManager.prototype, "executeSelectionInTerminal", null);
__decorate([
    telemetry_1.captureTelemetry(constants_2.EXECUTION_DJANGO, { scope: 'selection' }, false)
], CodeExecutionManager.prototype, "executeSelectionInDjangoShell", null);
CodeExecutionManager = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.ICommandManager)),
    __param(1, inversify_1.inject(types_1.IDocumentManager)),
    __param(2, inversify_1.inject(types_2.IDisposableRegistry)),
    __param(3, inversify_1.inject(types_3.IServiceContainer))
], CodeExecutionManager);
exports.CodeExecutionManager = CodeExecutionManager;
//# sourceMappingURL=codeExecutionManager.js.map