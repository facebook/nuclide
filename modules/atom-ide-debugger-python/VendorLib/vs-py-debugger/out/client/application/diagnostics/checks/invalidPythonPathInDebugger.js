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
require("../../../common/extensions");
const logger_1 = require("../../../common/logger");
const types_1 = require("../../../common/types");
const contracts_1 = require("../../../interpreter/contracts");
const types_2 = require("../../../ioc/types");
const base_1 = require("../base");
const types_3 = require("../commands/types");
const constants_1 = require("../constants");
const promptHandler_1 = require("../promptHandler");
const types_4 = require("../types");
const InvalidPythonPathInDebuggerMessage = 'You need to select a Python interpreter before you start debugging.\n\nTip: click on "Select Python Interpreter" in the status bar.';
class InvalidPythonPathInDebuggerDiagnostic extends base_1.BaseDiagnostic {
    constructor() {
        super(constants_1.DiagnosticCodes.InvalidDebuggerTypeDiagnostic, InvalidPythonPathInDebuggerMessage, vscode_1.DiagnosticSeverity.Error, types_4.DiagnosticScope.WorkspaceFolder);
    }
}
exports.InvalidPythonPathInDebuggerDiagnostic = InvalidPythonPathInDebuggerDiagnostic;
exports.InvalidPythonPathInDebuggerServiceId = 'InvalidPythonPathInDebuggerServiceId';
const CommandName = 'python.setInterpreter';
let InvalidPythonPathInDebuggerService = class InvalidPythonPathInDebuggerService extends base_1.BaseDiagnosticsService {
    constructor(serviceContainer) {
        super([constants_1.DiagnosticCodes.InvalidPythonPathInDebuggerDiagnostic], serviceContainer);
        this.messageService = serviceContainer.get(types_4.IDiagnosticHandlerService, promptHandler_1.DiagnosticCommandPromptHandlerServiceId);
    }
    diagnose() {
        return __awaiter(this, void 0, void 0, function* () {
            return [];
        });
    }
    handle(diagnostics) {
        return __awaiter(this, void 0, void 0, function* () {
            // This class can only handle one type of diagnostic, hence just use first item in list.
            if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
                return;
            }
            const diagnostic = diagnostics[0];
            const commandFactory = this.serviceContainer.get(types_3.IDiagnosticsCommandFactory);
            const options = [
                {
                    prompt: 'Select Python Interpreter',
                    command: commandFactory.createCommand(diagnostic, { type: 'executeVSCCommand', options: CommandName })
                }
            ];
            yield this.messageService.handle(diagnostic, { commandPrompts: options });
        });
    }
    validatePythonPath(pythonPath, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-template-strings
            if (pythonPath === '${config:python.pythonPath}' || !pythonPath) {
                const configService = this.serviceContainer.get(types_1.IConfigurationService);
                pythonPath = configService.getSettings(resource).pythonPath;
            }
            const helper = this.serviceContainer.get(contracts_1.IInterpreterHelper);
            if (yield helper.getInterpreterInformation(pythonPath).catch(() => undefined)) {
                return true;
            }
            this.handle([new InvalidPythonPathInDebuggerDiagnostic()])
                .catch(ex => logger_1.Logger.error('Failed to handle invalid python path in debugger', ex))
                .ignoreErrors();
            return false;
        });
    }
};
InvalidPythonPathInDebuggerService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], InvalidPythonPathInDebuggerService);
exports.InvalidPythonPathInDebuggerService = InvalidPythonPathInDebuggerService;
//# sourceMappingURL=invalidPythonPathInDebugger.js.map