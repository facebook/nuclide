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
const types_1 = require("../../../common/application/types");
require("../../../common/extensions");
const types_2 = require("../../../common/platform/types");
const types_3 = require("../../../common/types");
const contracts_1 = require("../../../interpreter/contracts");
const types_4 = require("../../../ioc/types");
const base_1 = require("../base");
const types_5 = require("../commands/types");
const constants_1 = require("../constants");
const promptHandler_1 = require("../promptHandler");
const types_6 = require("../types");
const messages = {
    [constants_1.DiagnosticCodes.NoPythonInterpretersDiagnostic]: 'Python is not installed. Please download and install Python before using the extension.',
    [constants_1.DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic]: 'You have selected the macOS system install of Python, which is not recommended for use with the Python extension. Some functionality will be limited, please select a different interpreter.',
    [constants_1.DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic]: 'The macOS system install of Python is not recommended, some functionality in the extension will be limited. Install another version of Python for the best experience.'
};
class InvalidPythonInterpreterDiagnostic extends base_1.BaseDiagnostic {
    constructor(code) {
        super(code, messages[code], vscode_1.DiagnosticSeverity.Error, types_6.DiagnosticScope.WorkspaceFolder);
    }
}
exports.InvalidPythonInterpreterDiagnostic = InvalidPythonInterpreterDiagnostic;
exports.InvalidPythonInterpreterServiceId = 'InvalidPythonInterpreterServiceId';
let InvalidPythonInterpreterService = class InvalidPythonInterpreterService extends base_1.BaseDiagnosticsService {
    constructor(serviceContainer) {
        super([constants_1.DiagnosticCodes.NoPythonInterpretersDiagnostic,
            constants_1.DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
            constants_1.DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic], serviceContainer);
        this.changeThrottleTimeout = 1000;
        this.addPythonPathChangedHandler();
    }
    diagnose() {
        return __awaiter(this, void 0, void 0, function* () {
            const configurationService = this.serviceContainer.get(types_3.IConfigurationService);
            const settings = configurationService.getSettings();
            if (settings.disableInstallationChecks === true) {
                return [];
            }
            const interpreterService = this.serviceContainer.get(contracts_1.IInterpreterService);
            const interpreters = yield interpreterService.getInterpreters();
            if (interpreters.length === 0) {
                return [new InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.NoPythonInterpretersDiagnostic)];
            }
            const platform = this.serviceContainer.get(types_2.IPlatformService);
            if (!platform.isMac) {
                return [];
            }
            const helper = this.serviceContainer.get(contracts_1.IInterpreterHelper);
            if (!helper.isMacDefaultPythonPath(settings.pythonPath)) {
                return [];
            }
            const interpreter = yield interpreterService.getActiveInterpreter();
            if (!interpreter || interpreter.type !== contracts_1.InterpreterType.Unknown) {
                return [];
            }
            if (interpreters.filter(i => !helper.isMacDefaultPythonPath(i.path)).length === 0) {
                return [new InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic)];
            }
            return [new InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic)];
        });
    }
    handle(diagnostics) {
        return __awaiter(this, void 0, void 0, function* () {
            if (diagnostics.length === 0) {
                return;
            }
            const messageService = this.serviceContainer.get(types_6.IDiagnosticHandlerService, promptHandler_1.DiagnosticCommandPromptHandlerServiceId);
            yield Promise.all(diagnostics.map((diagnostic) => __awaiter(this, void 0, void 0, function* () {
                if (!this.canHandle(diagnostic)) {
                    return;
                }
                const commandPrompts = this.getCommandPrompts(diagnostic);
                return messageService.handle(diagnostic, { commandPrompts, message: diagnostic.message });
            })));
        });
    }
    addPythonPathChangedHandler() {
        const workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
        const disposables = this.serviceContainer.get(types_3.IDisposableRegistry);
        disposables.push(workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }
    onDidChangeConfiguration(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
            const workspacesUris = workspaceService.hasWorkspaceFolders ? workspaceService.workspaceFolders.map(workspace => workspace.uri) : [undefined];
            if (workspacesUris.findIndex(uri => event.affectsConfiguration('python.pythonPath', uri)) === -1) {
                return;
            }
            // Lets wait, for more changes, dirty simple throttling.
            if (this.timeOut) {
                clearTimeout(this.timeOut);
                this.timeOut = undefined;
            }
            this.timeOut = setTimeout(() => {
                this.timeOut = undefined;
                this.diagnose().then(dianostics => this.handle(dianostics)).ignoreErrors();
            }, this.changeThrottleTimeout);
        });
    }
    getCommandPrompts(diagnostic) {
        const commandFactory = this.serviceContainer.get(types_5.IDiagnosticsCommandFactory);
        switch (diagnostic.code) {
            case constants_1.DiagnosticCodes.NoPythonInterpretersDiagnostic: {
                return [{
                        prompt: 'Download',
                        command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://www.python.org/downloads' })
                    }];
            }
            case constants_1.DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic: {
                return [{
                        prompt: 'Select Python Interpreter',
                        command: commandFactory.createCommand(diagnostic, { type: 'executeVSCCommand', options: 'python.setInterpreter' })
                    }];
            }
            case constants_1.DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic: {
                return [{
                        prompt: 'Learn more',
                        command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites' })
                    },
                    {
                        prompt: 'Download',
                        command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://www.python.org/downloads' })
                    }];
            }
            default: {
                throw new Error('Invalid diagnostic for \'InvalidPythonInterpreterService\'');
            }
        }
    }
};
InvalidPythonInterpreterService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_4.IServiceContainer))
], InvalidPythonInterpreterService);
exports.InvalidPythonInterpreterService = InvalidPythonInterpreterService;
//# sourceMappingURL=pythonInterpreter.js.map