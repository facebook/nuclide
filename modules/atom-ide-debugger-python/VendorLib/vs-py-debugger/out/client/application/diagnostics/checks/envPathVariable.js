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
const types_4 = require("../../../ioc/types");
const base_1 = require("../base");
const types_5 = require("../commands/types");
const constants_1 = require("../constants");
const promptHandler_1 = require("../promptHandler");
const types_6 = require("../types");
const InvalidEnvPathVariableMessage = 'The environment variable \'{0}\' seems to have some paths containing the \'"\' character.' +
    ' The existence of such a character is known to have caused the {1} extension to not load. If the extension fails to load please modify your paths to remove this \'"\' character.';
class InvalidEnvironmentPathVariableDiagnostic extends base_1.BaseDiagnostic {
    constructor(message) {
        super(constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic, message, vscode_1.DiagnosticSeverity.Warning, types_6.DiagnosticScope.Global);
    }
}
exports.InvalidEnvironmentPathVariableDiagnostic = InvalidEnvironmentPathVariableDiagnostic;
exports.EnvironmentPathVariableDiagnosticsServiceId = 'EnvironmentPathVariableDiagnosticsServiceId';
let EnvironmentPathVariableDiagnosticsService = class EnvironmentPathVariableDiagnosticsService extends base_1.BaseDiagnosticsService {
    constructor(serviceContainer) {
        super([constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic], serviceContainer);
        this.platform = this.serviceContainer.get(types_2.IPlatformService);
        this.messageService = serviceContainer.get(types_6.IDiagnosticHandlerService, promptHandler_1.DiagnosticCommandPromptHandlerServiceId);
    }
    diagnose() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.platform.isWindows &&
                this.doesPathVariableHaveInvalidEntries()) {
                const env = this.serviceContainer.get(types_1.IApplicationEnvironment);
                const message = InvalidEnvPathVariableMessage
                    .format(this.platform.pathVariableName, env.extensionName);
                return [new InvalidEnvironmentPathVariableDiagnostic(message)];
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
            if (yield this.filterService.shouldIgnoreDiagnostic(diagnostic.code)) {
                return;
            }
            const commandFactory = this.serviceContainer.get(types_5.IDiagnosticsCommandFactory);
            const options = [
                {
                    prompt: 'Ignore'
                },
                {
                    prompt: 'Always Ignore',
                    command: commandFactory.createCommand(diagnostic, { type: 'ignore', options: types_6.DiagnosticScope.Global })
                },
                {
                    prompt: 'More Info',
                    command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://aka.ms/Niq35h' })
                }
            ];
            yield this.messageService.handle(diagnostic, { commandPrompts: options });
        });
    }
    doesPathVariableHaveInvalidEntries() {
        const currentProc = this.serviceContainer.get(types_3.ICurrentProcess);
        const pathValue = currentProc.env[this.platform.pathVariableName];
        const pathSeparator = this.serviceContainer.get(types_3.IPathUtils).delimiter;
        const paths = pathValue.split(pathSeparator);
        return paths.filter(item => item.indexOf('"') >= 0).length > 0;
    }
};
EnvironmentPathVariableDiagnosticsService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_4.IServiceContainer))
], EnvironmentPathVariableDiagnosticsService);
exports.EnvironmentPathVariableDiagnosticsService = EnvironmentPathVariableDiagnosticsService;
//# sourceMappingURL=envPathVariable.js.map