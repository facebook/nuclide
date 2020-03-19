// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const LocalDebugClient_1 = require("./LocalDebugClient");
class LocalDebugClientV2 extends LocalDebugClient_1.LocalDebugClient {
    constructor(args, debugSession, canLaunchTerminal, launcherScriptProvider) {
        super(args, debugSession, canLaunchTerminal, launcherScriptProvider);
    }
    buildDebugArguments(cwd, debugPort) {
        const launcher = this.launcherScriptProvider.getLauncherFilePath();
        const additionalPtvsdArgs = [];
        if (this.args.noDebug) {
            additionalPtvsdArgs.push('--nodebug');
        }
        return [launcher, ...additionalPtvsdArgs, '--client', '--host', 'localhost', '--port', debugPort.toString()];
    }
    buildStandardArguments() {
        const programArgs = Array.isArray(this.args.args) && this.args.args.length > 0 ? this.args.args : [];
        if (typeof this.args.module === 'string' && this.args.module.length > 0) {
            return ['-m', this.args.module, ...programArgs];
        }
        if (this.args.program && this.args.program.length > 0) {
            return [this.args.program, ...programArgs];
        }
        return programArgs;
    }
}
exports.LocalDebugClientV2 = LocalDebugClientV2;
//# sourceMappingURL=localDebugClientV2.js.map