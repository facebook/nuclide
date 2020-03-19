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
const async_1 = require("../../utils/async");
const types_1 = require("../types");
class BaseTerminalActivator {
    constructor(helper) {
        this.helper = helper;
        this.activatedTerminals = new Map();
    }
    activateEnvironmentInTerminal(terminal, resource, preserveFocus = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.activatedTerminals.has(terminal)) {
                return this.activatedTerminals.get(terminal);
            }
            const deferred = async_1.createDeferred();
            this.activatedTerminals.set(terminal, deferred.promise);
            const shellPath = this.helper.getTerminalShellPath();
            const terminalShellType = !shellPath || shellPath.length === 0 ? types_1.TerminalShellType.other : this.helper.identifyTerminalShell(shellPath);
            const activationCommamnds = yield this.helper.getEnvironmentActivationCommands(terminalShellType, resource);
            let activated = false;
            if (activationCommamnds) {
                for (const command of activationCommamnds) {
                    terminal.show(preserveFocus);
                    terminal.sendText(command);
                    yield this.waitForCommandToProcess(terminalShellType);
                    activated = true;
                }
            }
            deferred.resolve(activated);
            return activated;
        });
    }
    waitForCommandToProcess(shell) {
        return __awaiter(this, void 0, void 0, function* () {
            // Give the command some time to complete.
            // Its been observed that sending commands too early will strip some text off in VS Code Terminal.
            yield async_1.sleep(500);
        });
    }
}
exports.BaseTerminalActivator = BaseTerminalActivator;
//# sourceMappingURL=base.js.map