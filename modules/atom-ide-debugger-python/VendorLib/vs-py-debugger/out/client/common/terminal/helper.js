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
const contracts_1 = require("../../interpreter/contracts");
const types_1 = require("../../ioc/types");
const types_2 = require("../application/types");
require("../extensions");
const types_3 = require("../platform/types");
const types_4 = require("../types");
const condaActivationProvider_1 = require("./environmentActivationProviders/condaActivationProvider");
const types_5 = require("./types");
// Types of shells can be found here:
// 1. https://wiki.ubuntu.com/ChangingShells
const IS_GITBASH = /(gitbash.exe$)/i;
const IS_BASH = /(bash.exe$|bash$)/i;
const IS_WSL = /(wsl.exe$)/i;
const IS_ZSH = /(zsh$)/i;
const IS_KSH = /(ksh$)/i;
const IS_COMMAND = /cmd.exe$/i;
const IS_POWERSHELL = /(powershell.exe$|powershell$)/i;
const IS_POWERSHELL_CORE = /(pwsh.exe$|pwsh$)/i;
const IS_FISH = /(fish$)/i;
const IS_CSHELL = /(csh$)/i;
const IS_TCSHELL = /(tcsh$)/i;
let TerminalHelper = class TerminalHelper {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.detectableShells = new Map();
        this.detectableShells.set(types_5.TerminalShellType.powershell, IS_POWERSHELL);
        this.detectableShells.set(types_5.TerminalShellType.gitbash, IS_GITBASH);
        this.detectableShells.set(types_5.TerminalShellType.bash, IS_BASH);
        this.detectableShells.set(types_5.TerminalShellType.wsl, IS_WSL);
        this.detectableShells.set(types_5.TerminalShellType.zsh, IS_ZSH);
        this.detectableShells.set(types_5.TerminalShellType.ksh, IS_KSH);
        this.detectableShells.set(types_5.TerminalShellType.commandPrompt, IS_COMMAND);
        this.detectableShells.set(types_5.TerminalShellType.fish, IS_FISH);
        this.detectableShells.set(types_5.TerminalShellType.tcshell, IS_TCSHELL);
        this.detectableShells.set(types_5.TerminalShellType.cshell, IS_CSHELL);
        this.detectableShells.set(types_5.TerminalShellType.powershellCore, IS_POWERSHELL_CORE);
    }
    createTerminal(title) {
        const terminalManager = this.serviceContainer.get(types_2.ITerminalManager);
        return terminalManager.createTerminal({ name: title });
    }
    identifyTerminalShell(shellPath) {
        return Array.from(this.detectableShells.keys())
            .reduce((matchedShell, shellToDetect) => {
            if (matchedShell === types_5.TerminalShellType.other && this.detectableShells.get(shellToDetect).test(shellPath)) {
                return shellToDetect;
            }
            return matchedShell;
        }, types_5.TerminalShellType.other);
    }
    getTerminalShellPath() {
        const workspace = this.serviceContainer.get(types_2.IWorkspaceService);
        const shellConfig = workspace.getConfiguration('terminal.integrated.shell');
        const platformService = this.serviceContainer.get(types_3.IPlatformService);
        let osSection = '';
        if (platformService.isWindows) {
            osSection = 'windows';
        }
        else if (platformService.isMac) {
            osSection = 'osx';
        }
        else if (platformService.isLinux) {
            osSection = 'linux';
        }
        if (osSection.length === 0) {
            return '';
        }
        return shellConfig.get(osSection);
    }
    buildCommandForTerminal(terminalShellType, command, args) {
        const isPowershell = terminalShellType === types_5.TerminalShellType.powershell || terminalShellType === types_5.TerminalShellType.powershellCore;
        const commandPrefix = isPowershell ? '& ' : '';
        return `${commandPrefix}${command.fileToCommandArgument()} ${args.join(' ')}`.trim();
    }
    getEnvironmentActivationCommands(terminalShellType, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = this.serviceContainer.get(types_4.IConfigurationService).getSettings(resource);
            const activateEnvironment = settings.terminal.activateEnvironment;
            if (!activateEnvironment) {
                return;
            }
            // If we have a conda environment, then use that.
            const isCondaEnvironment = yield this.serviceContainer.get(contracts_1.ICondaService).isCondaEnvironment(settings.pythonPath);
            if (isCondaEnvironment) {
                const condaActivationProvider = new condaActivationProvider_1.CondaActivationCommandProvider(this.serviceContainer);
                const activationCommands = yield condaActivationProvider.getActivationCommands(resource, terminalShellType);
                if (Array.isArray(activationCommands)) {
                    return activationCommands;
                }
            }
            // Search from the list of providers.
            const providers = this.serviceContainer.getAll(types_5.ITerminalActivationCommandProvider);
            const supportedProviders = providers.filter(provider => provider.isShellSupported(terminalShellType));
            for (const provider of supportedProviders) {
                const activationCommands = yield provider.getActivationCommands(resource, terminalShellType);
                if (Array.isArray(activationCommands)) {
                    return activationCommands;
                }
            }
        });
    }
};
TerminalHelper = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], TerminalHelper);
exports.TerminalHelper = TerminalHelper;
//# sourceMappingURL=helper.js.map