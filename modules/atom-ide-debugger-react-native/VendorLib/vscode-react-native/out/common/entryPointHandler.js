"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const errorHelper_1 = require("./error/errorHelper");
const telemetryHelper_1 = require("./telemetryHelper");
const telemetry_1 = require("./telemetry");
const ConsoleLogger_1 = require("../extension/log/ConsoleLogger");
var ProcessType;
(function (ProcessType) {
    ProcessType[ProcessType["Extension"] = 0] = "Extension";
    ProcessType[ProcessType["Debugee"] = 1] = "Debugee";
    ProcessType[ProcessType["Debugger"] = 2] = "Debugger";
})(ProcessType = exports.ProcessType || (exports.ProcessType = {}));
/* This class should we used for each entry point of the code, so we handle telemetry and error reporting properly */
class EntryPointHandler {
    constructor(processType, logger = new ConsoleLogger_1.ConsoleLogger()) {
        this.logger = logger;
        this.processType = processType;
    }
    /* This method should wrap any async entry points to the code, so we handle telemetry and error reporting properly */
    runFunction(taskName, error, codeToRun, errorsAreFatal = false) {
        return this.handleErrors(error, telemetryHelper_1.TelemetryHelper.generate(taskName, codeToRun), /*errorsAreFatal*/ errorsAreFatal);
    }
    // This method should wrap the entry point of the whole app, so we handle telemetry and error reporting properly
    runApp(appName, appVersion, error, reporter, codeToRun) {
        try {
            telemetry_1.Telemetry.init(appName, appVersion, reporter);
            return this.runFunction(appName, error, codeToRun, true);
        }
        catch (error) {
            this.logger.error(error);
            throw error;
        }
    }
    handleErrors(error, resultOfCode, errorsAreFatal) {
        resultOfCode.done(() => { }, reason => {
            const isDebugeeProcess = this.processType === ProcessType.Debugee;
            const shouldLogStack = !errorsAreFatal || isDebugeeProcess;
            this.logger.error(error.message, errorHelper_1.ErrorHelper.wrapError(error, reason), shouldLogStack);
            // For the debugee process we don't want to throw an exception because the debugger
            // will appear to the user if he turned on the VS Code uncaught exceptions feature.
            if (errorsAreFatal) {
                if (isDebugeeProcess) {
                    process.exit(1);
                }
                else {
                    throw reason;
                }
            }
        });
    }
}
exports.EntryPointHandler = EntryPointHandler;

//# sourceMappingURL=entryPointHandler.js.map
