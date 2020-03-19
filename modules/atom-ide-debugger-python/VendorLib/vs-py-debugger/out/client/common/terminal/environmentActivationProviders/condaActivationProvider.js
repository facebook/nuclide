// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
const contracts_1 = require("../../../interpreter/contracts");
require("../../extensions");
const types_1 = require("../../platform/types");
const types_2 = require("../../types");
const types_3 = require("../types");
/**
 * Support conda env activation (in the terminal).
 */
let CondaActivationCommandProvider = class CondaActivationCommandProvider {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    /**
     * Is the given shell supported for activating a conda env?
     */
    isShellSupported(_targetShell) {
        return true;
    }
    /**
     * Return the command needed to activate the conda env.
     */
    getActivationCommands(resource, targetShell) {
        return __awaiter(this, void 0, void 0, function* () {
            const condaService = this.serviceContainer.get(contracts_1.ICondaService);
            const pythonPath = this.serviceContainer.get(types_2.IConfigurationService)
                .getSettings(resource).pythonPath;
            const envInfo = yield condaService.getCondaEnvironment(pythonPath);
            if (!envInfo) {
                return;
            }
            if (this.serviceContainer.get(types_1.IPlatformService).isWindows) {
                // windows activate can be a bit tricky due to conda changes.
                switch (targetShell) {
                    case types_3.TerminalShellType.powershell:
                    case types_3.TerminalShellType.powershellCore:
                        return this.getPowershellCommands(envInfo.name, targetShell);
                    // tslint:disable-next-line:no-suspicious-comment
                    // TODO: Do we really special-case fish on Windows?
                    case types_3.TerminalShellType.fish:
                        return this.getFishCommands(envInfo.name, yield condaService.getCondaFile());
                    default:
                        return this.getWindowsCommands(envInfo.name);
                }
            }
            else {
                switch (targetShell) {
                    case types_3.TerminalShellType.powershell:
                    case types_3.TerminalShellType.powershellCore:
                        return;
                    // tslint:disable-next-line:no-suspicious-comment
                    // TODO: What about pre-4.4.0?
                    case types_3.TerminalShellType.fish:
                        return this.getFishCommands(envInfo.name, yield condaService.getCondaFile());
                    default:
                        return this.getUnixCommands(envInfo.name, yield condaService.getCondaFile());
                }
            }
        });
    }
    getWindowsActivateCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            let activateCmd = 'activate';
            const condaService = this.serviceContainer.get(contracts_1.ICondaService);
            const condaExePath = yield condaService.getCondaFile();
            if (condaExePath && path.basename(condaExePath) !== condaExePath) {
                const condaScriptsPath = path.dirname(condaExePath);
                // prefix the cmd with the found path, and ensure it's quoted properly
                activateCmd = path.join(condaScriptsPath, activateCmd);
                activateCmd = activateCmd.toCommandArgument();
            }
            return activateCmd;
        });
    }
    getWindowsCommands(envName) {
        return __awaiter(this, void 0, void 0, function* () {
            const activate = yield this.getWindowsActivateCommand();
            return [
                `${activate} ${envName.toCommandArgument()}`
            ];
        });
    }
    getPowershellCommands(envName, targetShell) {
        return __awaiter(this, void 0, void 0, function* () {
            return;
        });
    }
    getFishCommands(envName, conda) {
        return __awaiter(this, void 0, void 0, function* () {
            // https://github.com/conda/conda/blob/be8c08c083f4d5e05b06bd2689d2cd0d410c2ffe/shell/etc/fish/conf.d/conda.fish#L18-L28
            return [
                `${conda.fileToCommandArgument()} activate ${envName.toCommandArgument()}`
            ];
        });
    }
    getUnixCommands(envName, conda) {
        return __awaiter(this, void 0, void 0, function* () {
            const condaDir = path.dirname(conda);
            const activateFile = path.join(condaDir, 'activate');
            return [
                `source ${activateFile.fileToCommandArgument()} ${envName.toCommandArgument()}`
            ];
        });
    }
};
CondaActivationCommandProvider = __decorate([
    inversify_1.injectable()
], CondaActivationCommandProvider);
exports.CondaActivationCommandProvider = CondaActivationCommandProvider;
//# sourceMappingURL=condaActivationProvider.js.map