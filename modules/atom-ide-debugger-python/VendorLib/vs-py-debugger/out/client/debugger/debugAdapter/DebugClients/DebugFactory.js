"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const launcherProvider_1 = require("./launcherProvider");
const localDebugClientV2_1 = require("./localDebugClientV2");
const nonDebugClientV2_1 = require("./nonDebugClientV2");
const RemoteDebugClient_1 = require("./RemoteDebugClient");
function CreateLaunchDebugClient(launchRequestOptions, debugSession, canLaunchTerminal) {
    let launchScriptProvider;
    let debugClientClass;
    if (launchRequestOptions.noDebug === true) {
        launchScriptProvider = new launcherProvider_1.NoDebugLauncherScriptProvider();
        debugClientClass = nonDebugClientV2_1.NonDebugClientV2;
    }
    else {
        launchScriptProvider = new launcherProvider_1.DebuggerLauncherScriptProvider();
        debugClientClass = localDebugClientV2_1.LocalDebugClientV2;
    }
    return new debugClientClass(launchRequestOptions, debugSession, canLaunchTerminal, launchScriptProvider);
}
exports.CreateLaunchDebugClient = CreateLaunchDebugClient;
function CreateAttachDebugClient(attachRequestOptions, debugSession) {
    return new RemoteDebugClient_1.RemoteDebugClient(attachRequestOptions, debugSession);
}
exports.CreateAttachDebugClient = CreateAttachDebugClient;
//# sourceMappingURL=DebugFactory.js.map