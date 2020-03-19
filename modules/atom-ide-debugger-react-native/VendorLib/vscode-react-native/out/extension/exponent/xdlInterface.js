"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const commandExecutor_1 = require("../../common/commandExecutor");
const hostPlatform_1 = require("../../common/hostPlatform");
const OutputChannelLogger_1 = require("../log/OutputChannelLogger");
const path = require("path");
const Q = require("q");
const logger = OutputChannelLogger_1.OutputChannelLogger.getMainChannel();
const EXPO_DEPS = [
    "xdl",
    "@expo/ngrok",
];
let xdlPackage;
function getPackage() {
    if (xdlPackage) {
        return xdlPackage;
    }
    // Don't do the require if we don't actually need it
    try {
        logger.debug("Getting exponent dependecy.");
        const xdl = require("xdl");
        xdlPackage = Q(xdl);
        return xdlPackage;
    }
    catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            logger.debug("Dependency not present. Installing it...");
        }
        else {
            throw e;
        }
    }
    let commandExecutor = new commandExecutor_1.CommandExecutor(path.dirname(require.resolve("../../../")), logger);
    xdlPackage = commandExecutor.spawnWithProgress(hostPlatform_1.HostPlatform.getNpmCliCommand("npm"), ["install", ...EXPO_DEPS, "--verbose", "--no-save"], { verbosity: commandExecutor_1.CommandVerbosity.PROGRESS })
        .then(() => {
        return require("xdl");
    });
    return xdlPackage;
}
function configReactNativeVersionWargnings() {
    return getPackage()
        .then((xdl) => {
        xdl.Config.validation.reactNativeVersionWarnings = false;
    });
}
exports.configReactNativeVersionWargnings = configReactNativeVersionWargnings;
function attachLoggerStream(rootPath, options) {
    return getPackage()
        .then((xdl) => xdl.ProjectUtils.attachLoggerStream(rootPath, options));
}
exports.attachLoggerStream = attachLoggerStream;
function supportedVersions() {
    return getPackage()
        .then((xdl) => xdl.Versions.facebookReactNativeVersionsAsync());
}
exports.supportedVersions = supportedVersions;
function currentUser() {
    return getPackage()
        .then((xdl) => xdl.User.getCurrentUserAsync());
}
exports.currentUser = currentUser;
function login(username, password) {
    return getPackage()
        .then((xdl) => xdl.User.loginAsync("user-pass", { username: username, password: password }));
}
exports.login = login;
function mapVersion(reactNativeVersion) {
    return getPackage()
        .then((xdl) => xdl.Versions.facebookReactNativeVersionToExpoVersionAsync(reactNativeVersion));
}
exports.mapVersion = mapVersion;
function publish(projectRoot, options) {
    return getPackage()
        .then((xdl) => xdl.Project.publishAsync(projectRoot, options));
}
exports.publish = publish;
function setOptions(projectRoot, options) {
    return getPackage()
        .then((xdl) => xdl.Project.setOptionsAsync(projectRoot, options));
}
exports.setOptions = setOptions;
function startExponentServer(projectRoot) {
    return getPackage()
        .then((xdl) => xdl.Project.startExpoServerAsync(projectRoot));
}
exports.startExponentServer = startExponentServer;
function startTunnels(projectRoot) {
    return getPackage()
        .then((xdl) => xdl.Project.startTunnelsAsync(projectRoot));
}
exports.startTunnels = startTunnels;
function getUrl(projectRoot, options) {
    return getPackage()
        .then((xdl) => xdl.Project.getUrlAsync(projectRoot, options));
}
exports.getUrl = getUrl;
function stopAll(projectRoot) {
    return getPackage()
        .then((xdl) => xdl.Project.stopAsync(projectRoot));
}
exports.stopAll = stopAll;

//# sourceMappingURL=xdlInterface.js.map
