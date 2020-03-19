"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const packager_1 = require("../common/packager");
const LogHelper_1 = require("./log/LogHelper");
const vscode = { workspace: { rootPath: "" } };
// END MODIFIED BY PELMERS
class SettingsHelper {
    /**
     * We get the packager port configured by the user
     */
    static getPackagerPort(fsPath) {
        // BEGIN MODIFIED BY PELMERS
        // END MODIFIED BY PELMERS
        return packager_1.Packager.DEFAULT_PORT;
    }
    /**
     * Get logLevel setting
     */
    static getLogLevel() {
        // BEGIN MODIFIED BY PELMERS
        // END MODIFIED BY PELMERS
        return LogHelper_1.LogLevel.Info;
    }
    /**
     * Get the React Native project root path
     */
    static getReactNativeProjectRoot(fsPath) {
        // BEGIN MODIFIED BY PELMERS
        // END MODIFIED BY PELMERS
        return vscode.workspace.rootPath;
    }
    /**
     * Get command line run arguments from settings.json
     */
    // BEGIN MODIFIED BY PELMERS
    static getRunArgs(platform, target, uri) {
        // END MODIFIED BY PELMERS
        return [];
    }
    // BEGIN MODIFIED BY PELMERS
    static getEnvArgs(platform, target, uri) {
        // END MODIFIED BY PELMERS
        return {};
    }
    // BEGIN MODIFIED BY PELMERS
    static getEnvFile(platform, target, uri) {
        // END MODIFIED BY PELMERS
        return "";
    }
}
exports.SettingsHelper = SettingsHelper;

//# sourceMappingURL=settingsHelper.js.map
