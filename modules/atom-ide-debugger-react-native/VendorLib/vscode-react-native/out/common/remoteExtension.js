"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
// BEGIN MODIFIED BY PELMERS
const platformResolver_1 = require("../extension/platformResolver");
const targetPlatformHelper_1 = require("./targetPlatformHelper");
const settingsHelper_1 = require("../extension/settingsHelper");
const packager_1 = require("./packager");
const vscode_uri_1 = require("vscode-uri");
const Q = require("q");
class RemoteExtension {
    constructor(projectRootPath, reactNativePackager) {
        this.projectRootPath = projectRootPath;
        this.reactNativePackager = reactNativePackager;
    }
    static atProjectRootPath(projectRootPath, port) {
        const packager = new packager_1.Packager(projectRootPath, projectRootPath, port);
        return new RemoteExtension(projectRootPath, packager);
    }
    getPackagerPort(program) {
        return Q(this.reactNativePackager.packagerPort);
    }
    showDevMenu(deviceId) {
        return Q(null);
    }
    reloadApp(deviceId) {
        return Q(null);
    }
    stopMonitoringLogcat() {
        return Q(null);
    }
    openFileAtLocation(args) {
        return Q(null);
    }
    sendTelemetry(args) {
        return Q(null);
    }
    showInformationMessage(args) {
        return Q(null);
    }
    // TODO(pelmers): mostly copied from extensionServer.launch
    launch(request) {
        let mobilePlatformOptions = this.requestSetup(request.arguments);
        // We add the parameter if it's defined (adapter crashes otherwise)
        if (!isNullOrUndefined(request.arguments.logCatArguments)) {
            mobilePlatformOptions.logCatArguments = [parseLogCatArguments(request.arguments.logCatArguments)];
        }
        if (!isNullOrUndefined(request.arguments.variant)) {
            mobilePlatformOptions.variant = request.arguments.variant;
        }
        if (!isNullOrUndefined(request.arguments.scheme)) {
            mobilePlatformOptions.scheme = request.arguments.scheme;
        }
        mobilePlatformOptions.packagerPort = this.reactNativePackager.packagerPort;
        const platformDeps = {
            packager: this.reactNativePackager,
        };
        const mobilePlatform = new platformResolver_1.PlatformResolver()
            .resolveMobilePlatform(request.arguments.platform, mobilePlatformOptions, platformDeps);
        return Q(new Promise((resolve, reject) => {
            targetPlatformHelper_1.TargetPlatformHelper.checkTargetPlatformSupport(mobilePlatformOptions.platform);
            return mobilePlatform.startPackager()
                .then(() => {
                // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                console.error("Prewarming bundle cache. This may take a while ...");
                return mobilePlatform.prewarmBundleCache();
            })
                .then(() => {
                console.error("Building and running application.");
                return mobilePlatform.runApp();
            })
                .then(() => {
                return mobilePlatform.enableJSDebuggingMode();
            })
                .then(() => {
                resolve();
            })
                .catch(error => {
                console.error(error);
                reject(error);
            });
        }));
    }
    requestSetup(args) {
        const projectRootPath = this.projectRootPath;
        let mobilePlatformOptions = {
            projectRoot: projectRootPath,
            platform: args.platform,
            env: args.env,
            envFile: args.envFile,
            target: args.target || "simulator",
        };
        if (!args.runArguments) {
            let runArgs = settingsHelper_1.SettingsHelper.getRunArgs(args.platform, args.target || "simulator", vscode_uri_1.default.file(projectRootPath));
            mobilePlatformOptions.runArguments = runArgs;
        }
        else {
            mobilePlatformOptions.runArguments = args.runArguments;
        }
        return mobilePlatformOptions;
    }
}
exports.RemoteExtension = RemoteExtension;
function isNullOrUndefined(value) {
    return typeof value === "undefined" || value === null;
}
/**
 * Parses log cat arguments to a string
 */
function parseLogCatArguments(userProvidedLogCatArguments) {
    return Array.isArray(userProvidedLogCatArguments)
        ? userProvidedLogCatArguments.join(" ") // If it's an array, we join the arguments
        : userProvidedLogCatArguments; // If not, we leave it as-is
}
// END MODIFIED BY PELMERS

//# sourceMappingURL=remoteExtension.js.map
