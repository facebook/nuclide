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
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../../common/application/types");
require("../../../common/extensions");
const types_2 = require("../../../common/platform/types");
const types_3 = require("../../../ioc/types");
const base_1 = require("../base");
const types_4 = require("../commands/types");
const constants_1 = require("../constants");
const promptHandler_1 = require("../promptHandler");
const types_5 = require("../types");
const InvalidDebuggerTypeMessage = 'Your launch.json file needs to be updated to change the "pythonExperimental" debug ' +
    'configurations to use the "python" debugger type, otherwise Python debugging may ' +
    'not work. Would you like to automatically update your launch.json file now?';
class InvalidDebuggerTypeDiagnostic extends base_1.BaseDiagnostic {
    constructor(message) {
        super(constants_1.DiagnosticCodes.InvalidDebuggerTypeDiagnostic, message, vscode_1.DiagnosticSeverity.Error, types_5.DiagnosticScope.WorkspaceFolder);
    }
}
exports.InvalidDebuggerTypeDiagnostic = InvalidDebuggerTypeDiagnostic;
exports.InvalidDebuggerTypeDiagnosticsServiceId = 'InvalidDebuggerTypeDiagnosticsServiceId';
const CommandName = 'python.debugger.replaceExperimental';
let InvalidDebuggerTypeDiagnosticsService = class InvalidDebuggerTypeDiagnosticsService extends base_1.BaseDiagnosticsService {
    constructor(serviceContainer) {
        super([constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic], serviceContainer);
        this.messageService = serviceContainer.get(types_5.IDiagnosticHandlerService, promptHandler_1.DiagnosticCommandPromptHandlerServiceId);
        const cmdManager = serviceContainer.get(types_1.ICommandManager);
        this.fs = this.serviceContainer.get(types_2.IFileSystem);
        cmdManager.registerCommand(CommandName, this.fixLaunchJson, this);
    }
    diagnose() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isExperimentalDebuggerUsed()) {
                return [new InvalidDebuggerTypeDiagnostic(InvalidDebuggerTypeMessage)];
            }
            else {
                return [];
            }
        });
    }
    handle(diagnostics) {
        return __awaiter(this, void 0, void 0, function* () {
            // This class can only handle one type of diagnostic, hence just use first item in list.
            if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
                return;
            }
            const diagnostic = diagnostics[0];
            const commandFactory = this.serviceContainer.get(types_4.IDiagnosticsCommandFactory);
            const options = [
                {
                    prompt: 'Yes, update launch.json',
                    command: commandFactory.createCommand(diagnostic, { type: 'executeVSCCommand', options: 'python.debugger.replaceExperimental' })
                },
                {
                    prompt: 'No, I will do it later'
                }
            ];
            yield this.messageService.handle(diagnostic, { commandPrompts: options });
        });
    }
    isExperimentalDebuggerUsed() {
        return __awaiter(this, void 0, void 0, function* () {
            const workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
            if (!workspaceService.hasWorkspaceFolders) {
                return false;
            }
            const results = yield Promise.all(workspaceService.workspaceFolders.map(workspaceFolder => this.isExperimentalDebuggerUsedInWorkspace(workspaceFolder)));
            return results.filter(used => used === true).length > 0;
        });
    }
    getLaunchJsonFile(workspaceFolder) {
        return path.join(workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
    }
    isExperimentalDebuggerUsedInWorkspace(workspaceFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            const launchJson = this.getLaunchJsonFile(workspaceFolder);
            if (!(yield this.fs.fileExists(launchJson))) {
                return false;
            }
            const fileContents = yield this.fs.readFile(launchJson);
            return fileContents.indexOf('"pythonExperimental"') > 0;
        });
    }
    fixLaunchJson() {
        return __awaiter(this, void 0, void 0, function* () {
            const workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
            if (!workspaceService.hasWorkspaceFolders) {
                return false;
            }
            yield Promise.all(workspaceService.workspaceFolders.map(workspaceFolder => this.fixLaunchJsonInWorkspace(workspaceFolder)));
        });
    }
    fixLaunchJsonInWorkspace(workspaceFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.isExperimentalDebuggerUsedInWorkspace(workspaceFolder))) {
                return;
            }
            const launchJson = this.getLaunchJsonFile(workspaceFolder);
            let fileContents = yield this.fs.readFile(launchJson);
            const debuggerType = new RegExp('"pythonExperimental"', 'g');
            const debuggerLabel = new RegExp('"Python Experimental:', 'g');
            fileContents = fileContents.replace(debuggerType, '"python"');
            fileContents = fileContents.replace(debuggerLabel, '"Python:');
            yield this.fs.writeFile(launchJson, fileContents);
        });
    }
};
InvalidDebuggerTypeDiagnosticsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], InvalidDebuggerTypeDiagnosticsService);
exports.InvalidDebuggerTypeDiagnosticsService = InvalidDebuggerTypeDiagnosticsService;
//# sourceMappingURL=invalidDebuggerType.js.map