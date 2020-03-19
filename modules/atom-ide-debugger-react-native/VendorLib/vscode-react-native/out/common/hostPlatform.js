"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const childProcess_1 = require("./node/childProcess");
const targetPlatformHelper_1 = require("./targetPlatformHelper");
const path = require("path");
/**
 * Defines the identifiers of all the platforms we support.
 */
var HostPlatformId;
(function (HostPlatformId) {
    HostPlatformId[HostPlatformId["WINDOWS"] = 0] = "WINDOWS";
    HostPlatformId[HostPlatformId["OSX"] = 1] = "OSX";
    HostPlatformId[HostPlatformId["LINUX"] = 2] = "LINUX";
})(HostPlatformId = exports.HostPlatformId || (exports.HostPlatformId = {}));
/**
 * IHostPlatform implemenation for the Windows platform.
 */
class WindowsHostPlatform {
    getUserHomePath() {
        return process.env.USERPROFILE;
    }
    setEnvironmentVariable(name, value) {
        return new childProcess_1.ChildProcess().exec(`setx ${name} ${value}`).outcome;
    }
    getSettingsHome() {
        return path.join(process.env.APPDATA, "vscode-react-native");
    }
    getNpmCliCommand(cliName) {
        return `${cliName}.cmd`;
    }
    getPipePath(pipeName) {
        return `//?/pipe/${pipeName}`;
    }
    getPlatformId() {
        return HostPlatformId.WINDOWS;
    }
    getUserID() {
        return process.env.USERNAME;
    }
    isCompatibleWithTarget(targetPlatformId) {
        return targetPlatformId === targetPlatformHelper_1.TargetPlatformId.ANDROID || targetPlatformId === targetPlatformHelper_1.TargetPlatformId.EXPONENT;
    }
}
class UnixHostPlatform {
    getUserHomePath() {
        return process.env.HOME;
    }
    getSettingsHome() {
        return path.join(process.env.HOME, ".vscode-react-native");
    }
    getNpmCliCommand(packageName) {
        return packageName;
    }
    getPipePath(pipeName) {
        return `/tmp/${pipeName}.sock`;
    }
}
/**
 * IHostPlatform implemenation for the OSX platform.
 */
class OSXHostPlatform extends UnixHostPlatform {
    setEnvironmentVariable(name, value) {
        return new childProcess_1.ChildProcess().exec(`launchctl setenv ${name} ${value}`).outcome;
    }
    getPlatformId() {
        return HostPlatformId.OSX;
    }
    getUserID() {
        return process.env.LOGNAME;
    }
    isCompatibleWithTarget(targetPlatformId) {
        return targetPlatformId === targetPlatformHelper_1.TargetPlatformId.ANDROID || targetPlatformId === targetPlatformHelper_1.TargetPlatformId.IOS || targetPlatformId === targetPlatformHelper_1.TargetPlatformId.EXPONENT;
    }
}
/**
 * IHostPlatform implemenation for the Linux platform.
 */
class LinuxHostPlatform extends UnixHostPlatform {
    setEnvironmentVariable(name, value) {
        return new childProcess_1.ChildProcess().exec(`export ${name}=${value}`).outcome;
    }
    getPlatformId() {
        return HostPlatformId.LINUX;
    }
    getUserID() {
        return process.env.USER;
    }
    isCompatibleWithTarget(targetPlatformId) {
        return targetPlatformId === targetPlatformHelper_1.TargetPlatformId.ANDROID || targetPlatformId === targetPlatformHelper_1.TargetPlatformId.EXPONENT;
    }
}
/**
 * Allows platform specific operations based on the user's OS.
 */
class HostPlatform {
    /**
     * Resolves the dev machine, desktop platform.
     */
    static get platform() {
        if (!HostPlatform.platformInstance) {
            switch (process.platform) {
                case "win32":
                    HostPlatform.platformInstance = new WindowsHostPlatform();
                    break;
                case "darwin":
                    HostPlatform.platformInstance = new OSXHostPlatform();
                    break;
                case "linux":
                    HostPlatform.platformInstance = new LinuxHostPlatform();
                    break;
                default:
                    HostPlatform.platformInstance = new LinuxHostPlatform();
                    break;
            }
        }
        return HostPlatform.platformInstance;
    }
    static getUserHomePath() {
        return HostPlatform.platform.getUserHomePath();
    }
    static getSettingsHome() {
        return HostPlatform.platform.getSettingsHome();
    }
    static getNpmCliCommand(packageName) {
        return HostPlatform.platform.getNpmCliCommand(packageName);
    }
    static getPipePath(pipeName) {
        return HostPlatform.platform.getPipePath(pipeName);
    }
    static getPlatformId() {
        return HostPlatform.platform.getPlatformId();
    }
    static setEnvironmentVariable(name, value) {
        return HostPlatform.platform.setEnvironmentVariable(name, value);
    }
    /* Returns a value that is unique for each user of this computer */
    static getUserID() {
        return HostPlatform.platform.getUserID();
    }
    static isCompatibleWithTarget(targetPlatformId) {
        return HostPlatform.platform.isCompatibleWithTarget(targetPlatformId);
    }
}
exports.HostPlatform = HostPlatform;

//# sourceMappingURL=hostPlatform.js.map
