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
const commandPrompt_1 = require("../../../common/terminal/commandPrompt");
const types_1 = require("../../../common/types");
const types_2 = require("../../../ioc/types");
const base_1 = require("../base");
const types_3 = require("../commands/types");
const constants_1 = require("../constants");
const promptHandler_1 = require("../promptHandler");
const types_4 = require("../types");
const PowershellActivationNotSupportedWithBatchFilesMessage = 'Activation of the selected Python environment is not supported in PowerShell. Consider changing your shell to Command Prompt.';
class PowershellActivationNotAvailableDiagnostic extends base_1.BaseDiagnostic {
    constructor() {
        super(constants_1.DiagnosticCodes.EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic, PowershellActivationNotSupportedWithBatchFilesMessage, vscode_1.DiagnosticSeverity.Warning, types_4.DiagnosticScope.Global);
    }
}
exports.PowershellActivationNotAvailableDiagnostic = PowershellActivationNotAvailableDiagnostic;
exports.PowerShellActivationHackDiagnosticsServiceId = 'EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic';
let PowerShellActivationHackDiagnosticsService = class PowerShellActivationHackDiagnosticsService extends base_1.BaseDiagnosticsService {
    constructor(serviceContainer) {
        super([constants_1.DiagnosticCodes.EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic], serviceContainer);
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
            if (yield this.filterService.shouldIgnoreDiagnostic(diagnostic.code)) {
                return;
            }
            const commandFactory = this.serviceContainer.get(types_3.IDiagnosticsCommandFactory);
            const currentProcess = this.serviceContainer.get(types_1.ICurrentProcess);
            const configurationService = this.serviceContainer.get(types_1.IConfigurationService);
            const options = [
                {
                    prompt: 'Use Command Prompt',
                    // tslint:disable-next-line:no-object-literal-type-assertion
                    command: {
                        diagnostic, invoke: () => __awaiter(this, void 0, void 0, function* () {
                            commandPrompt_1.useCommandPromptAsDefaultShell(currentProcess, configurationService)
                                .catch(ex => logger_1.Logger.error('Use Command Prompt as default shell', ex));
                        })
                    }
                },
                {
                    prompt: 'Ignore'
                },
                {
                    prompt: 'Always Ignore',
                    command: commandFactory.createCommand(diagnostic, { type: 'ignore', options: types_4.DiagnosticScope.Global })
                },
                {
                    prompt: 'More Info',
                    command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://aka.ms/CondaPwsh' })
                }
            ];
            yield this.messageService.handle(diagnostic, { commandPrompts: options });
        });
    }
};
PowerShellActivationHackDiagnosticsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], PowerShellActivationHackDiagnosticsService);
exports.PowerShellActivationHackDiagnosticsService = PowerShellActivationHackDiagnosticsService;
//# sourceMappingURL=powerShellActivation.js.map