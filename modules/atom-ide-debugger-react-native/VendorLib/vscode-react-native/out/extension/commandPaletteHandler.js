"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const Q = require("q");
const XDL = require("./exponent/xdlInterface");
const settingsHelper_1 = require("./settingsHelper");
const OutputChannelLogger_1 = require("./log/OutputChannelLogger");
const packager_1 = require("../common/packager");
const androidPlatform_1 = require("./android/androidPlatform");
const iOSPlatform_1 = require("./ios/iOSPlatform");
const packagerStatusIndicator_1 = require("./packagerStatusIndicator");
const reactNativeProjectHelper_1 = require("../common/reactNativeProjectHelper");
const targetPlatformHelper_1 = require("../common/targetPlatformHelper");
const telemetryHelper_1 = require("../common/telemetryHelper");
class CommandPaletteHandler {
    static addFolder(workspaceFolder, stuff) {
        this.projectsCache[workspaceFolder.uri.fsPath] = Object.assign({}, stuff, { workspaceFolder });
    }
    static getFolder(workspaceFolder) {
        return this.projectsCache[workspaceFolder.uri.fsPath];
    }
    static delFolder(workspaceFolder) {
        delete this.projectsCache[workspaceFolder.uri.fsPath];
    }
    /**
     * Starts the React Native packager
     */
    static startPackager() {
        return this.selectProject()
            .then((project) => {
            return this.executeCommandInContext("startPackager", project.workspaceFolder, () => project.packager.isRunning()
                .then((running) => {
                return running ? project.packager.stop() : Q.resolve(void 0);
            }))
                .then(() => this.runStartPackagerCommandAndUpdateStatus(project));
        });
    }
    /**
     * Starts the Exponent packager
     */
    static startExponentPackager() {
        return this.selectProject()
            .then((project) => {
            return this.executeCommandInContext("startExponentPackager", project.workspaceFolder, () => project.packager.isRunning()
                .then((running) => {
                return running ? project.packager.stop() : Q.resolve(void 0);
            })).then(() => project.exponentHelper.configureExponentEnvironment()).then(() => this.runStartPackagerCommandAndUpdateStatus(project, packager_1.PackagerRunAs.EXPONENT));
        });
    }
    /**
     * Kills the React Native packager invoked by the extension's packager
     */
    static stopPackager() {
        return this.selectProject()
            .then((project) => {
            return this.executeCommandInContext("stopPackager", project.workspaceFolder, () => project.packager.stop())
                .then(() => project.packager.statusIndicator.updatePackagerStatus(packagerStatusIndicator_1.PackagerStatus.PACKAGER_STOPPED));
        });
    }
    static stopAllPackagers() {
        let keys = Object.keys(this.projectsCache);
        let promises = [];
        keys.forEach((key) => {
            let project = this.projectsCache[key];
            promises.push(this.executeCommandInContext("stopPackager", project.workspaceFolder, () => project.packager.stop())
                .then(() => project.packager.statusIndicator.updatePackagerStatus(packagerStatusIndicator_1.PackagerStatus.PACKAGER_STOPPED)));
        });
        return Q.all(promises).then(() => { });
    }
    /**
     * Restarts the React Native packager
     */
    static restartPackager() {
        return this.selectProject()
            .then((project) => {
            return this.executeCommandInContext("restartPackager", project.workspaceFolder, () => this.runRestartPackagerCommandAndUpdateStatus(project));
        });
    }
    /**
     * Execute command to publish to exponent host.
     */
    static publishToExpHost() {
        return this.selectProject()
            .then((project) => {
            return this.executeCommandInContext("publishToExpHost", project.workspaceFolder, () => {
                return this.executePublishToExpHost(project).then((didPublish) => {
                    if (!didPublish) {
                        CommandPaletteHandler.logger.warning("Publishing was unsuccessful. Please make sure you are logged in Exponent and your project is a valid Exponentjs project");
                    }
                });
            });
        });
    }
    /**
     * Executes the 'react-native run-android' command
     */
    static runAndroid(target = "simulator") {
        targetPlatformHelper_1.TargetPlatformHelper.checkTargetPlatformSupport("android");
        return this.selectProject()
            .then((project) => {
            return this.executeCommandInContext("runAndroid", project.workspaceFolder, () => this.executeWithPackagerRunning(project, () => {
                const packagerPort = settingsHelper_1.SettingsHelper.getPackagerPort(project.workspaceFolder.uri.fsPath);
                const runArgs = settingsHelper_1.SettingsHelper.getRunArgs("android", target, project.workspaceFolder.uri);
                const envArgs = settingsHelper_1.SettingsHelper.getEnvArgs("android", target, project.workspaceFolder.uri);
                const envFile = settingsHelper_1.SettingsHelper.getEnvFile("android", target, project.workspaceFolder.uri);
                const projectRoot = settingsHelper_1.SettingsHelper.getReactNativeProjectRoot(project.workspaceFolder.uri.fsPath);
                const runOptions = {
                    platform: "android",
                    workspaceRoot: project.workspaceFolder.uri.fsPath,
                    projectRoot: projectRoot,
                    packagerPort: packagerPort,
                    runArguments: runArgs,
                    env: envArgs,
                    envFile: envFile,
                };
                const platform = new androidPlatform_1.AndroidPlatform(runOptions, {
                    packager: project.packager,
                });
                return platform.runApp(/*shouldLaunchInAllDevices*/ true)
                    .then(() => {
                    return platform.disableJSDebuggingMode();
                });
            }));
        });
    }
    /**
     * Executes the 'react-native run-ios' command
     */
    static runIos(target = "simulator") {
        targetPlatformHelper_1.TargetPlatformHelper.checkTargetPlatformSupport("ios");
        return this.selectProject()
            .then((project) => {
            return this.executeCommandInContext("runIos", project.workspaceFolder, () => this.executeWithPackagerRunning(project, () => {
                const packagerPort = settingsHelper_1.SettingsHelper.getPackagerPort(project.workspaceFolder.uri.fsPath);
                const runArgs = settingsHelper_1.SettingsHelper.getRunArgs("ios", target, project.workspaceFolder.uri);
                const envArgs = settingsHelper_1.SettingsHelper.getEnvArgs("ios", target, project.workspaceFolder.uri);
                const envFile = settingsHelper_1.SettingsHelper.getEnvFile("ios", target, project.workspaceFolder.uri);
                const platform = new iOSPlatform_1.IOSPlatform({
                    platform: "ios",
                    workspaceRoot: project.workspaceFolder.uri.fsPath,
                    projectRoot: project.workspaceFolder.uri.fsPath,
                    packagerPort: packagerPort,
                    runArguments: runArgs,
                    env: envArgs,
                    envFile: envFile,
                }, { packager: project.packager });
                // Set the Debugging setting to disabled, because in iOS it's persisted across runs of the app
                return platform.disableJSDebuggingMode()
                    .catch(() => { }) // If setting the debugging mode fails, we ignore the error and we run the run ios command anyways
                    .then(() => {
                    return platform.runApp();
                });
            }));
        });
    }
    static showDevMenu() {
        return this.selectProject()
            .then((project) => {
            androidPlatform_1.AndroidPlatform.showDevMenu()
                .catch(() => { }); // Ignore any errors
            iOSPlatform_1.IOSPlatform.showDevMenu(project.workspaceFolder.uri.fsPath)
                .catch(() => { }); // Ignore any errors
            return Q.resolve(void 0);
        });
    }
    static reloadApp() {
        return this.selectProject()
            .then((project) => {
            androidPlatform_1.AndroidPlatform.reloadApp()
                .catch(() => { }); // Ignore any errors
            iOSPlatform_1.IOSPlatform.reloadApp(project.workspaceFolder.uri.fsPath)
                .catch(() => { }); // Ignore any errors
            return Q.resolve(void 0);
        });
    }
    static runRestartPackagerCommandAndUpdateStatus(project) {
        return project.packager.restart(settingsHelper_1.SettingsHelper.getPackagerPort(project.workspaceFolder.uri.fsPath))
            .then(() => project.packager.statusIndicator.updatePackagerStatus(packagerStatusIndicator_1.PackagerStatus.PACKAGER_STARTED));
    }
    /**
     * Helper method to run packager and update appropriate configurations
     */
    static runStartPackagerCommandAndUpdateStatus(project, startAs = packager_1.PackagerRunAs.REACT_NATIVE) {
        if (startAs === packager_1.PackagerRunAs.EXPONENT) {
            return this.loginToExponent(project)
                .then(() => project.packager.startAsExponent()).then(exponentUrl => {
                project.packager.statusIndicator.updatePackagerStatus(packagerStatusIndicator_1.PackagerStatus.EXPONENT_PACKAGER_STARTED);
                CommandPaletteHandler.logger.info("Application is running on Exponent.");
                const exponentOutput = `Open your exponent app at ${exponentUrl}`;
                CommandPaletteHandler.logger.info(exponentOutput);
                vscode.commands.executeCommand("vscode.previewHtml", vscode.Uri.parse(exponentUrl), 1, "Expo QR code");
            });
        }
        return project.packager.startAsReactNative()
            .then(() => project.packager.statusIndicator.updatePackagerStatus(packagerStatusIndicator_1.PackagerStatus.PACKAGER_STARTED));
    }
    /**
     * Executes a lambda function after starting the packager
     * {lambda} The lambda function to be executed
     */
    static executeWithPackagerRunning(project, lambda) {
        // Start the packager before executing the React-Native command
        CommandPaletteHandler.logger.info("Attempting to start the React Native packager");
        return this.runStartPackagerCommandAndUpdateStatus(project).then(lambda);
    }
    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    static executeCommandInContext(rnCommand, workspaceFolder, operation) {
        return telemetryHelper_1.TelemetryHelper.generate("RNCommand", (generator) => {
            generator.add("command", rnCommand, false);
            const projectRoot = settingsHelper_1.SettingsHelper.getReactNativeProjectRoot(workspaceFolder.uri.fsPath);
            return reactNativeProjectHelper_1.ReactNativeProjectHelper.isReactNativeProject(projectRoot).then(isRNProject => {
                generator.add("isRNProject", isRNProject, false);
                if (isRNProject) {
                    // Bring the log channel to focus
                    CommandPaletteHandler.logger.setFocusOnLogChannel();
                    // Execute the operation
                    return operation();
                }
                else {
                    vscode.window.showErrorMessage("Current workspace is not a React Native project.");
                    return;
                }
            });
        });
    }
    /**
     * Publish project to exponent server. In order to do this we need to make sure the user is logged in exponent and the packager is running.
     */
    static executePublishToExpHost(project) {
        CommandPaletteHandler.logger.info("Publishing app to Exponent server. This might take a moment.");
        return this.loginToExponent(project)
            .then(user => {
            CommandPaletteHandler.logger.debug(`Publishing as ${user.username}...`);
            return this.startExponentPackager()
                .then(() => XDL.publish(project.workspaceFolder.uri.fsPath))
                .then(response => {
                if (response.err || !response.url) {
                    return false;
                }
                const publishedOutput = `App successfully published to ${response.url}`;
                CommandPaletteHandler.logger.info(publishedOutput);
                vscode.window.showInformationMessage(publishedOutput);
                return true;
            });
        }).catch(() => {
            CommandPaletteHandler.logger.warning("An error has occured. Please make sure you are logged in to exponent, your project is setup correctly for publishing and your packager is running as exponent.");
            return false;
        });
    }
    static loginToExponent(project) {
        return project.exponentHelper.loginToExponent((message, password) => {
            return Q.Promise((resolve, reject) => {
                vscode.window.showInputBox({ placeHolder: message, password: password })
                    .then(login => {
                    resolve(login || "");
                }, reject);
            });
        }, (message) => {
            return Q.Promise((resolve, reject) => {
                vscode.window.showInformationMessage(message)
                    .then(password => {
                    resolve(password || "");
                }, reject);
            });
        });
    }
    static selectProject() {
        let keys = Object.keys(this.projectsCache);
        if (keys.length > 1) {
            return Q.Promise((resolve, reject) => {
                vscode.window.showQuickPick(keys)
                    .then((selected) => {
                    if (selected) {
                        resolve(this.projectsCache[selected]);
                    }
                }, reject);
            });
        }
        else if (keys.length === 1) {
            return Q.resolve(this.projectsCache[keys[0]]);
        }
        else {
            return Q.reject();
        }
    }
}
CommandPaletteHandler.projectsCache = {};
CommandPaletteHandler.logger = OutputChannelLogger_1.OutputChannelLogger.getMainChannel();
exports.CommandPaletteHandler = CommandPaletteHandler;

//# sourceMappingURL=commandPaletteHandler.js.map
