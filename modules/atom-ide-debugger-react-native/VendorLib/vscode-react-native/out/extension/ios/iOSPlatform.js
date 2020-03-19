"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const path = require("path");
const semver = require("semver");
const childProcess_1 = require("../../common/node/childProcess");
const commandExecutor_1 = require("../../common/commandExecutor");
const generalMobilePlatform_1 = require("../generalMobilePlatform");
const plistBuddy_1 = require("./plistBuddy");
const iOSDebugModeManager_1 = require("./iOSDebugModeManager");
const outputVerifier_1 = require("../../common/outputVerifier");
const errorHelper_1 = require("../../common/error/errorHelper");
const settingsHelper_1 = require("../settingsHelper");
const remoteExtension_1 = require("../../common/remoteExtension");
const reactNativeProjectHelper_1 = require("../../common/reactNativeProjectHelper");
class IOSPlatform extends generalMobilePlatform_1.GeneralMobilePlatform {
    constructor(runOptions, platformDeps = {}) {
        super(runOptions, platformDeps);
        this.runOptions = runOptions;
        this.plistBuddy = new plistBuddy_1.PlistBuddy();
        this.targetType = "simulator";
        if (this.runOptions.iosRelativeProjectPath) {
            this.logger.warning("'iosRelativeProjectPath' option is deprecated. Please use 'runArguments' instead");
        }
        this.iosProjectRoot = path.join(this.projectPath, this.runOptions.iosRelativeProjectPath || IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH);
        this.iosDebugModeManager = new iOSDebugModeManager_1.IOSDebugModeManager(this.iosProjectRoot);
        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            this.targetType = (this.runOptions.runArguments.indexOf(`--${IOSPlatform.deviceString}`) >= 0) ?
                IOSPlatform.deviceString : IOSPlatform.simulatorString;
            return;
        }
        if (this.runOptions.target && (this.runOptions.target !== IOSPlatform.simulatorString &&
            this.runOptions.target !== IOSPlatform.deviceString)) {
            this.targetType = IOSPlatform.simulatorString;
            return;
        }
        this.targetType = this.runOptions.target || IOSPlatform.simulatorString;
    }
    static showDevMenu(fsPath, deviceId) {
        return this.remote(fsPath).showDevMenu(deviceId);
    }
    static reloadApp(fsPath, deviceId) {
        return this.remote(fsPath).reloadApp(deviceId);
    }
    runApp() {
        // Compile, deploy, and launch the app on either a simulator or a device
        const runArguments = this.getRunArgument();
        const env = this.getEnvArgument();
        return reactNativeProjectHelper_1.ReactNativeProjectHelper.getReactNativeVersion(this.runOptions.projectRoot)
            .then(version => {
            if (semver.gte(version, IOSPlatform.NO_PACKAGER_VERSION)) {
                runArguments.push("--no-packager");
            }
            const runIosSpawn = new commandExecutor_1.CommandExecutor(this.projectPath, this.logger).spawnReactCommand("run-ios", runArguments, { env });
            return new outputVerifier_1.OutputVerifier(() => this.generateSuccessPatterns(), () => Q(IOSPlatform.RUN_IOS_FAILURE_PATTERNS)).process(runIosSpawn);
        });
    }
    enableJSDebuggingMode() {
        // Configure the app for debugging
        if (this.targetType === IOSPlatform.deviceString) {
            // Note that currently we cannot automatically switch the device into debug mode.
            this.logger.info("Application is running on a device, please shake device and select 'Debug JS Remotely' to enable debugging.");
            return Q.resolve(void 0);
        }
        // Wait until the configuration file exists, and check to see if debugging is enabled
        return Q.all([
            this.iosDebugModeManager.getSimulatorRemoteDebuggingSetting(),
            this.getBundleId(),
        ])
            .spread((debugModeEnabled, bundleId) => {
            if (debugModeEnabled) {
                return Q.resolve(void 0);
            }
            // Debugging must still be enabled
            // We enable debugging by writing to a plist file that backs a NSUserDefaults object,
            // but that file is written to by the app on occasion. To avoid races, we shut the app
            // down before writing to the file.
            const childProcess = new childProcess_1.ChildProcess();
            return childProcess.execToString("xcrun simctl spawn booted launchctl list")
                .then((output) => {
                // Try to find an entry that looks like UIKitApplication:com.example.myApp[0x4f37]
                const regex = new RegExp(`(\\S+${bundleId}\\S+)`);
                const match = regex.exec(output);
                // If we don't find a match, the app must not be running and so we do not need to close it
                return match ? childProcess.exec(`xcrun simctl spawn booted launchctl stop ${match[1]}`) : null;
            })
                .then(() => {
                // Write to the settings file while the app is not running to avoid races
                return this.iosDebugModeManager.setSimulatorRemoteDebuggingSetting(/*enable=*/ true);
            })
                .then(() => {
                // Relaunch the app
                return this.runApp();
            });
        });
    }
    disableJSDebuggingMode() {
        return this.iosDebugModeManager.setSimulatorRemoteDebuggingSetting(/*enable=*/ false);
    }
    prewarmBundleCache() {
        return this.packager.prewarmBundleCache("ios");
    }
    getRunArgument() {
        let runArguments = [];
        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            runArguments = this.runOptions.runArguments;
        }
        else {
            if (this.runOptions.target) {
                if (this.runOptions.target === IOSPlatform.deviceString ||
                    this.runOptions.target === IOSPlatform.simulatorString) {
                    runArguments.push(`--${this.runOptions.target}`);
                }
                else {
                    runArguments.push("--simulator", `${this.runOptions.target}`);
                }
            }
            if (this.runOptions.iosRelativeProjectPath) {
                runArguments.push("--project-path", this.runOptions.iosRelativeProjectPath);
            }
            // provide any defined scheme
            if (this.runOptions.scheme) {
                runArguments.push("--scheme", this.runOptions.scheme);
            }
        }
        return runArguments;
    }
    generateSuccessPatterns() {
        return this.targetType === IOSPlatform.deviceString ?
            Q(IOSPlatform.RUN_IOS_SUCCESS_PATTERNS.concat("INSTALLATION SUCCEEDED")) :
            this.getBundleId()
                .then(bundleId => IOSPlatform.RUN_IOS_SUCCESS_PATTERNS
                .concat([`Launching ${bundleId}\n${bundleId}: `]));
    }
    getBundleId() {
        return this.plistBuddy.getBundleId(this.iosProjectRoot);
    }
    static remote(fsPath) {
        if (this.remoteExtension) {
            return this.remoteExtension;
        }
        else {
            // BEGIN MODIFIED BY PELMERS
            return this.remoteExtension = remoteExtension_1.RemoteExtension.atProjectRootPath(settingsHelper_1.SettingsHelper.getReactNativeProjectRoot(fsPath), settingsHelper_1.SettingsHelper.getPackagerPort(fsPath));
            // END MODIFIED BY PELMERS
        }
    }
}
IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH = "ios";
// We should add the common iOS build/run errors we find to this list
IOSPlatform.RUN_IOS_FAILURE_PATTERNS = [{
        pattern: "No devices are booted",
        message: errorHelper_1.ErrorHelper.ERROR_STRINGS.IOSSimulatorNotLaunchable,
    }, {
        pattern: "FBSOpenApplicationErrorDomain",
        message: errorHelper_1.ErrorHelper.ERROR_STRINGS.IOSSimulatorNotLaunchable,
    }, {
        pattern: "ios-deploy",
        message: errorHelper_1.ErrorHelper.ERROR_STRINGS.IOSDeployNotFound,
    }];
IOSPlatform.RUN_IOS_SUCCESS_PATTERNS = ["BUILD SUCCEEDED"];
exports.IOSPlatform = IOSPlatform;

//# sourceMappingURL=iOSPlatform.js.map
