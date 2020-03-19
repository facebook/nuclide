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
const types_2 = require("../../ioc/types");
exports.DiagnosticCommandPromptHandlerServiceId = 'DiagnosticCommandPromptHandlerServiceId';
let DiagnosticCommandPromptHandlerService = class DiagnosticCommandPromptHandlerService {
    constructor(serviceContainer) {
        this.appShell = serviceContainer.get(types_1.IApplicationShell);
    }
    handle(diagnostic, options = { commandPrompts: [] }) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompts = options.commandPrompts.map(option => option.prompt);
            const response = yield this.displayMessage(options.message ? options.message : diagnostic.message, diagnostic.severity, prompts);
            if (!response) {
                return;
            }
            const selectedOption = options.commandPrompts.find(option => option.prompt === response);
            if (selectedOption && selectedOption.command) {
                yield selectedOption.command.invoke();
            }
        });
    }
    displayMessage(message, severity, prompts) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (severity) {
                case vscode_1.DiagnosticSeverity.Error: {
                    return this.appShell.showErrorMessage(message, ...prompts);
                }
                case vscode_1.DiagnosticSeverity.Warning: {
                    return this.appShell.showWarningMessage(message, ...prompts);
                }
                default: {
                    return this.appShell.showInformationMessage(message, ...prompts);
                }
            }
        });
    }
};
DiagnosticCommandPromptHandlerService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], DiagnosticCommandPromptHandlerService);
exports.DiagnosticCommandPromptHandlerService = DiagnosticCommandPromptHandlerService;
//# sourceMappingURL=promptHandler.js.map