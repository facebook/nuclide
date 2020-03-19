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
const powerShellActivation_1 = require("../../../application/diagnostics/checks/powerShellActivation");
const types_1 = require("../../../application/diagnostics/types");
const types_2 = require("../../platform/types");
const types_3 = require("../types");
let PowershellTerminalActivationFailedHandler = class PowershellTerminalActivationFailedHandler {
    constructor(helper, platformService, diagnosticService) {
        this.helper = helper;
        this.platformService = platformService;
        this.diagnosticService = diagnosticService;
    }
    handleActivation(_terminal, resource, _preserveFocus, activated) {
        return __awaiter(this, void 0, void 0, function* () {
            if (activated || !this.platformService.isWindows) {
                return;
            }
            const shell = this.helper.identifyTerminalShell(this.helper.getTerminalShellPath());
            if (shell !== types_3.TerminalShellType.powershell && shell !== types_3.TerminalShellType.powershellCore) {
                return;
            }
            // Check if we can activate in Command Prompt.
            const activationCommands = yield this.helper.getEnvironmentActivationCommands(types_3.TerminalShellType.commandPrompt, resource);
            if (!activationCommands || !Array.isArray(activationCommands) || activationCommands.length === 0) {
                return;
            }
            this.diagnosticService.handle([new powerShellActivation_1.PowershellActivationNotAvailableDiagnostic()]).ignoreErrors();
        });
    }
};
PowershellTerminalActivationFailedHandler = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.ITerminalHelper)),
    __param(1, inversify_1.inject(types_2.IPlatformService)),
    __param(2, inversify_1.inject(types_1.IDiagnosticsService)), __param(2, inversify_1.named(powerShellActivation_1.PowerShellActivationHackDiagnosticsServiceId))
], PowershellTerminalActivationFailedHandler);
exports.PowershellTerminalActivationFailedHandler = PowershellTerminalActivationFailedHandler;
//# sourceMappingURL=powershellFailedHandler.js.map