"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const OutputChannelLogger_1 = require("../log/OutputChannelLogger");
const promise_1 = require("../../common/node/promise");
const plistBuddy_1 = require("./plistBuddy");
const simulatorPlist_1 = require("./simulatorPlist");
class IOSDebugModeManager {
    constructor(projectRoot) {
        this.logger = OutputChannelLogger_1.OutputChannelLogger.getMainChannel();
        this.projectRoot = projectRoot;
        this.simulatorPlist = new simulatorPlist_1.SimulatorPlist(this.projectRoot);
    }
    setSimulatorRemoteDebuggingSetting(enable) {
        const plistBuddy = new plistBuddy_1.PlistBuddy();
        // Find the plistFile with the configuration setting
        // There is a race here between us checking for the plist file, and the application starting up.
        return this.findPListFile()
            .then((plistFile) => {
            // Set the executorClass to be RCTWebSocketExecutor so on the next startup it will default into debug mode
            // This is approximately equivalent to clicking the "Debug in Chrome" button
            return (enable
                ? plistBuddy.setPlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME, IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME)
                : plistBuddy.deletePlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME))
                .then(() => plistBuddy.setPlistBooleanProperty(plistFile, IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME, enable));
        });
    }
    getSimulatorRemoteDebuggingSetting() {
        return this.findPListFile()
            .then((plistFile) => {
            // Attempt to read from the file, but if the property is not defined then return the empty string
            return Q.all([
                new plistBuddy_1.PlistBuddy().readPlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME),
                new plistBuddy_1.PlistBuddy().readPlistProperty(plistFile, IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME),
            ])
                .spread((executorClassName, remoteDebugEnabled) => {
                return executorClassName === IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME
                    && remoteDebugEnabled === "true";
            })
                .catch(() => false);
        });
    }
    findPListFile() {
        const pu = new promise_1.PromiseUtil();
        const failureString = `Unable to find plist file to configure debugging`;
        return pu.retryAsync(() => this.tryOneAttemptToFindPListFile(), // Operation to retry until successful
        (file) => file !== "", // Condition to check if the operation was successful, and this logic is done
        IOSDebugModeManager.MAX_RETRIES, IOSDebugModeManager.DELAY_UNTIL_RETRY, failureString); // Error to show in case all retries fail
    }
    tryOneAttemptToFindPListFile() {
        return this.simulatorPlist.findPlistFile().catch(reason => {
            this.logger.debug(`Failed one attempt to find plist file: ${reason}`);
            return "";
        });
    }
}
IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME = "RCTWebSocketExecutor";
IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME = ":RCTDevMenu:executorClass";
IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME = ":RCTDevMenu:isDebuggingRemotely";
IOSDebugModeManager.MAX_RETRIES = 5;
IOSDebugModeManager.DELAY_UNTIL_RETRY = 2000;
exports.IOSDebugModeManager = IOSDebugModeManager;

//# sourceMappingURL=iOSDebugModeManager.js.map
