// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const DebugClient_1 = require("./DebugClient");
const localDebugClientV2_1 = require("./localDebugClientV2");
class NonDebugClientV2 extends localDebugClientV2_1.LocalDebugClientV2 {
    constructor(args, debugSession, canLaunchTerminal, launcherScriptProvider) {
        super(args, debugSession, canLaunchTerminal, launcherScriptProvider);
    }
    get DebugType() {
        return DebugClient_1.DebugType.RunLocal;
    }
    Stop() {
        super.Stop();
        if (this.pyProc) {
            try {
                this.pyProc.kill();
                // tslint:disable-next-line:no-empty
            }
            catch (_a) { }
            this.pyProc = undefined;
        }
    }
    handleProcessOutput(proc, _failedToLaunch) {
        // Do nothing
    }
}
exports.NonDebugClientV2 = NonDebugClientV2;
//# sourceMappingURL=nonDebugClientV2.js.map