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
const types_1 = require("../../../ioc/types");
require("../../extensions");
const types_2 = require("../types");
const baseActivationProvider_1 = require("./baseActivationProvider");
let Bash = class Bash extends baseActivationProvider_1.BaseActivationCommandProvider {
    constructor(serviceContainer) {
        super(serviceContainer);
    }
    isShellSupported(targetShell) {
        return targetShell === types_2.TerminalShellType.bash ||
            targetShell === types_2.TerminalShellType.gitbash ||
            targetShell === types_2.TerminalShellType.wsl ||
            targetShell === types_2.TerminalShellType.ksh ||
            targetShell === types_2.TerminalShellType.zsh ||
            targetShell === types_2.TerminalShellType.cshell ||
            targetShell === types_2.TerminalShellType.tcshell ||
            targetShell === types_2.TerminalShellType.fish;
    }
    getActivationCommandsForInterpreter(pythonPath, targetShell) {
        return __awaiter(this, void 0, void 0, function* () {
            const scriptFile = yield this.findScriptFile(pythonPath, this.getScriptsInOrderOfPreference(targetShell));
            if (!scriptFile) {
                return;
            }
            return [`source ${scriptFile.fileToCommandArgument()}`];
        });
    }
    getScriptsInOrderOfPreference(targetShell) {
        switch (targetShell) {
            case types_2.TerminalShellType.wsl:
            case types_2.TerminalShellType.ksh:
            case types_2.TerminalShellType.zsh:
            case types_2.TerminalShellType.gitbash:
            case types_2.TerminalShellType.bash: {
                return ['activate.sh', 'activate'];
            }
            case types_2.TerminalShellType.tcshell:
            case types_2.TerminalShellType.cshell: {
                return ['activate.csh'];
            }
            case types_2.TerminalShellType.fish: {
                return ['activate.fish'];
            }
            default: {
                return [];
            }
        }
    }
};
Bash = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], Bash);
exports.Bash = Bash;
//# sourceMappingURL=bash.js.map