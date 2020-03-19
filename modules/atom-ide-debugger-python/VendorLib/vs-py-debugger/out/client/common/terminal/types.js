"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
var TerminalShellType;
(function (TerminalShellType) {
    TerminalShellType["powershell"] = "powershell";
    TerminalShellType["powershellCore"] = "powershellCore";
    TerminalShellType["commandPrompt"] = "commandPrompt";
    TerminalShellType["gitbash"] = "gitbash";
    TerminalShellType["bash"] = "bash";
    TerminalShellType["zsh"] = "zsh";
    TerminalShellType["ksh"] = "ksh";
    TerminalShellType["fish"] = "fish";
    TerminalShellType["cshell"] = "cshell";
    TerminalShellType["tcshell"] = "tshell";
    TerminalShellType["wsl"] = "wsl";
    TerminalShellType["other"] = "other";
})(TerminalShellType = exports.TerminalShellType || (exports.TerminalShellType = {}));
exports.ITerminalServiceFactory = Symbol('ITerminalServiceFactory');
exports.ITerminalHelper = Symbol('ITerminalHelper');
exports.ITerminalActivator = Symbol('ITerminalActivator');
exports.ITerminalActivationCommandProvider = Symbol('ITerminalActivationCommandProvider');
exports.ITerminalActivationHandler = Symbol('ITerminalActivationHandler');
//# sourceMappingURL=types.js.map