"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const path = require("path");
const vscode = require("vscode");
const semver = require("semver");
const fileSystem_1 = require("../common/node/fileSystem");
const commandPaletteHandler_1 = require("./commandPaletteHandler");
const packager_1 = require("../common/packager");
const entryPointHandler_1 = require("../common/entryPointHandler");
const errorHelper_1 = require("../common/error/errorHelper");
const internalErrorCode_1 = require("../common/error/internalErrorCode");
const settingsHelper_1 = require("./settingsHelper");
const packagerStatusIndicator_1 = require("./packagerStatusIndicator");
const reactNativeProjectHelper_1 = require("../common/reactNativeProjectHelper");
const reactDirManager_1 = require("./reactDirManager");
const telemetry_1 = require("../common/telemetry");
const telemetryHelper_1 = require("../common/telemetryHelper");
const extensionServer_1 = require("./extensionServer");
const OutputChannelLogger_1 = require("./log/OutputChannelLogger");
const exponentHelper_1 = require("./exponent/exponentHelper");
const qrCodeContentProvider_1 = require("./qrCodeContentProvider");
/* all components use the same packager instance */
const outputChannelLogger = OutputChannelLogger_1.OutputChannelLogger.getMainChannel();
const entryPointHandler = new entryPointHandler_1.EntryPointHandler(entryPointHandler_1.ProcessType.Extension, outputChannelLogger);
const fsUtil = new fileSystem_1.FileSystem();
function activate(context) {
    const appVersion = require("../../package.json").version;
    const reporter = telemetry_1.Telemetry.defaultTelemetryReporter(appVersion);
    entryPointHandler.runApp("react-native", appVersion, errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.ExtensionActivationFailed), reporter, () => {
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => onChangeWorkspaceFolders(context, event)));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => onChangeConfiguration(context)));
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("exp", new qrCodeContentProvider_1.QRCodeContentProvider()));
        registerReactNativeCommands(context);
        let activateExtensionEvent = telemetryHelper_1.TelemetryHelper.createTelemetryEvent("activate");
        telemetry_1.Telemetry.send(activateExtensionEvent);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            workspaceFolders.forEach((folder) => {
                onFolderAdded(context, folder);
            });
        }
    });
}
exports.activate = activate;
function deactivate() {
    return Q.Promise(function (resolve) {
        // Kill any packager processes that we spawned
        entryPointHandler.runFunction("extension.deactivate", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToStopPackagerOnExit), () => {
            commandPaletteHandler_1.CommandPaletteHandler.stopAllPackagers().done(() => {
                // Tell vscode that we are done with deactivation
                resolve(void 0);
            });
        }, /*errorsAreFatal*/ true);
    });
}
exports.deactivate = deactivate;
function onChangeWorkspaceFolders(context, event) {
    if (event.removed.length) {
        event.removed.forEach((folder) => {
            onFolderRemoved(context, folder);
        });
    }
    if (event.added.length) {
        event.added.forEach((folder) => {
            onFolderAdded(context, folder);
        });
    }
}
function onChangeConfiguration(context) {
    // TODO implements
}
function onFolderAdded(context, folder) {
    let rootPath = folder.uri.fsPath;
    let projectRootPath = settingsHelper_1.SettingsHelper.getReactNativeProjectRoot(rootPath);
    reactNativeProjectHelper_1.ReactNativeProjectHelper.getReactNativeVersion(projectRootPath)
        .then(version => {
        if (version && isSupportedVersion(version)) {
            entryPointHandler.runFunction("debugger.setupLauncherStub", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.DebuggerStubLauncherFailed), () => {
                let reactDirManager = new reactDirManager_1.ReactDirManager(rootPath);
                return setupAndDispose(reactDirManager, context)
                    .then(() => {
                    let exponentHelper = new exponentHelper_1.ExponentHelper(rootPath, projectRootPath);
                    let packagerStatusIndicator = new packagerStatusIndicator_1.PackagerStatusIndicator();
                    let packager = new packager_1.Packager(rootPath, projectRootPath, settingsHelper_1.SettingsHelper.getPackagerPort(folder.uri.fsPath), packagerStatusIndicator);
                    let extensionServer = new extensionServer_1.ExtensionServer(projectRootPath, packager);
                    setupAndDispose(extensionServer, context);
                    commandPaletteHandler_1.CommandPaletteHandler.addFolder(folder, {
                        packager,
                        exponentHelper,
                        reactDirManager,
                        extensionServer,
                    });
                });
            });
            entryPointHandler.runFunction("debugger.setupNodeDebuggerLocation", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.NodeDebuggerConfigurationFailed), () => {
                configureNodeDebuggerLocation();
            });
        }
    });
}
function onFolderRemoved(context, folder) {
    let project = commandPaletteHandler_1.CommandPaletteHandler.getFolder(folder);
    Object.keys(project).forEach((key) => {
        if (project[key].dispose) {
            project[key].dispose();
        }
    });
    commandPaletteHandler_1.CommandPaletteHandler.delFolder(folder);
    try {
        context.subscriptions.forEach((element, index) => {
            if (element.isDisposed) {
                context.subscriptions.splice(index, 1); // Array.prototype.filter doesn't work, "context.subscriptions" is read only
            }
        });
    }
    catch (err) {
        // Ignore
    }
}
function configureNodeDebuggerLocation() {
    const nodeDebugExtension = vscode.extensions.getExtension("ms-vscode.node-debug2");
    if (!nodeDebugExtension) {
        return Q.reject(errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.CouldNotFindLocationOfNodeDebugger));
    }
    const nodeDebugPath = nodeDebugExtension.extensionPath;
    return fsUtil.writeFile(path.resolve(__dirname, "../", "debugger", "nodeDebugLocation.json"), JSON.stringify({ nodeDebugPath }));
}
function setupAndDispose(setuptableDisposable, context) {
    return setuptableDisposable.setup()
        .then(() => {
        context.subscriptions.push(setuptableDisposable);
        return setuptableDisposable;
    });
}
function isSupportedVersion(version) {
    if (!semver.gte(version, "0.19.0")) {
        telemetryHelper_1.TelemetryHelper.sendSimpleEvent("unsupportedRNVersion", { rnVersion: version });
        const shortMessage = `React Native Tools need React Native version 0.19.0 or later to be installed in <PROJECT_ROOT>/node_modules/`;
        const longMessage = `${shortMessage}: ${version}`;
        vscode.window.showWarningMessage(shortMessage);
        outputChannelLogger.warning(longMessage);
        return false;
    }
    else {
        return true;
    }
}
function registerReactNativeCommands(context) {
    // Register React Native commands
    registerVSCodeCommand(context, "runAndroidSimulator", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToRunOnAndroid), () => commandPaletteHandler_1.CommandPaletteHandler.runAndroid("simulator"));
    registerVSCodeCommand(context, "runAndroidDevice", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToRunOnAndroid), () => commandPaletteHandler_1.CommandPaletteHandler.runAndroid("device"));
    registerVSCodeCommand(context, "runIosSimulator", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToRunOnIos), () => commandPaletteHandler_1.CommandPaletteHandler.runIos("simulator"));
    registerVSCodeCommand(context, "runIosDevice", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToRunOnIos), () => commandPaletteHandler_1.CommandPaletteHandler.runIos("device"));
    registerVSCodeCommand(context, "startPackager", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToStartPackager), () => commandPaletteHandler_1.CommandPaletteHandler.startPackager());
    registerVSCodeCommand(context, "startExponentPackager", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToStartExponentPackager), () => commandPaletteHandler_1.CommandPaletteHandler.startExponentPackager());
    registerVSCodeCommand(context, "stopPackager", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToStopPackager), () => commandPaletteHandler_1.CommandPaletteHandler.stopPackager());
    registerVSCodeCommand(context, "restartPackager", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToRestartPackager), () => commandPaletteHandler_1.CommandPaletteHandler.restartPackager());
    registerVSCodeCommand(context, "publishToExpHost", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.FailedToPublishToExpHost), () => commandPaletteHandler_1.CommandPaletteHandler.publishToExpHost());
    registerVSCodeCommand(context, "showDevMenu", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.CommandFailed), () => commandPaletteHandler_1.CommandPaletteHandler.showDevMenu());
    registerVSCodeCommand(context, "reloadApp", errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.CommandFailed), () => commandPaletteHandler_1.CommandPaletteHandler.reloadApp());
}
function registerVSCodeCommand(context, commandName, error, commandHandler) {
    context.subscriptions.push(vscode.commands.registerCommand(`reactNative.${commandName}`, () => {
        return entryPointHandler.runFunction(`commandPalette.${commandName}`, error, commandHandler);
    }));
}

//# sourceMappingURL=rn-extension.js.map
