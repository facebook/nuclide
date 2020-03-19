"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const telemetryHelper_1 = require("../common/telemetryHelper");
const entryPointHandler_1 = require("../common/entryPointHandler");
const errorHelper_1 = require("../common/error/errorHelper");
const internalErrorCode_1 = require("../common/error/internalErrorCode");
const telemetryReporters_1 = require("../common/telemetryReporters");
const nodeDebugWrapper_1 = require("./nodeDebugWrapper");
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version;
const telemetryReporter = new telemetryReporters_1.ReassignableTelemetryReporter(new telemetryReporters_1.NullTelemetryReporter());
const extensionName = "react-native-debug-adapter";
function bailOut(reason) {
    // Things have gone wrong in initialization: Report the error to telemetry and exit
    telemetryHelper_1.TelemetryHelper.sendSimpleEvent(reason);
    process.exit(1);
}
function codeToRun() {
    /**
     * For debugging React Native we basically want to debug node plus some other stuff.
     * There is no need to create a new adapter for node because ther already exists one.
     * We look for node debug adapter on client's computer so we can jump of on top of that.
     */
    let nodeDebugFolder;
    let Node2DebugAdapter;
    // BEGIN MODIFIED BY PELMERS
    process.env.NODE_ENV = 'development';
    // END MODIFIED BY PELMERS
    // nodeDebugLocation.json is dynamically generated on extension activation.
    // If it fails, we must not have been in a react native project
    try {
        /* tslint:disable:no-var-requires */
        // BEGIN MODIFIED BY PELMERS
        Node2DebugAdapter = require('atom-ide-debugger-node/VendorLib/vscode-node-debug2/out/src/nodeDebugAdapter').NodeDebugAdapter; 
        // END MODIFIED BY PELMERS
        /* tslint:enable:no-var-requires */
        /**
         * We did find chrome debugger package and node2 debug adapter. Lets create debug
         * session and adapter with our customizations.
         */
        let session;
        let adapter;
        try {
            /* Create customised react-native debug adapter based on Node-debug2 adapter */
            adapter = nodeDebugWrapper_1.makeAdapter(Node2DebugAdapter);
            // Create a debug session class based on ChromeDebugSession
            session = nodeDebugWrapper_1.makeSession(vscode_chrome_debug_core_1.ChromeDebugSession, { adapter, extensionName }, telemetryReporter, extensionName, version);
            // Run the debug session for the node debug adapter with our modified requests
            vscode_chrome_debug_core_1.ChromeDebugSession.run(session);
        }
        catch (e) {
            const debugSession = new vscode_debugadapter_1.DebugSession();
            // Start session before sending any events otherwise the client wouldn't receive them
            debugSession.start(process.stdin, process.stdout);
            debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent("Unable to start debug adapter: " + e.toString(), "stderr"));
            debugSession.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
            bailOut(e.toString());
        }
    }
    catch (e) {
        // Nothing we can do here: can't even communicate back because we don't know how to speak debug adapter
        bailOut("cannotFindDebugAdapter");
    }
}
// Enable telemetry
const entryPointHandler = new entryPointHandler_1.EntryPointHandler(entryPointHandler_1.ProcessType.Debugger);
entryPointHandler.runApp(extensionName, version, errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.DebuggingFailed), telemetryReporter, codeToRun);

//# sourceMappingURL=reactNativeDebugEntryPoint.js.map
