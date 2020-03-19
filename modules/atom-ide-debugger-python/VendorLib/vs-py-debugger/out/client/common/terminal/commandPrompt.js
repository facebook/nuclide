// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_1 = require("vscode");
function getCommandPromptLocation(currentProcess) {
    // https://github.com/Microsoft/vscode/blob/master/src/vs/workbench/parts/terminal/electron-browser/terminalService.ts#L218
    // Determine the correct System32 path. We want to point to Sysnative
    // when the 32-bit version of VS Code is running on a 64-bit machine.
    // The reason for this is because PowerShell's important PSReadline
    // module doesn't work if this is not the case. See #27915.
    const is32ProcessOn64Windows = currentProcess.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
    const system32Path = path.join(currentProcess.env.windir, is32ProcessOn64Windows ? 'Sysnative' : 'System32');
    return path.join(system32Path, 'cmd.exe');
}
exports.getCommandPromptLocation = getCommandPromptLocation;
function useCommandPromptAsDefaultShell(currentProcess, configService) {
    return __awaiter(this, void 0, void 0, function* () {
        const cmdPromptLocation = getCommandPromptLocation(currentProcess);
        yield configService.updateSectionSetting('terminal', 'integrated.shell.windows', cmdPromptLocation, undefined, vscode_1.ConfigurationTarget.Global);
    });
}
exports.useCommandPromptAsDefaultShell = useCommandPromptAsDefaultShell;
//# sourceMappingURL=commandPrompt.js.map