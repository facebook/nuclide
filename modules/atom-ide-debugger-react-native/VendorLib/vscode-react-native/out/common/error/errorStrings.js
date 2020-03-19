"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_STRINGS = {
    "CommandFailed": "Error while executing command '{0}'",
    "CommandFailedWithErrorCode": "Command '{0}' failed with error code {1}",
    "ExpectedIntegerValue": "Expected an integer. Couldn't read {0}",
    "PackagerStartFailed": "Error while executing React Native Packager.",
    "IOSDeployNotFound": "Unable to find ios-deploy. Please make sure to install it globally('npm install -g is-deploy')",
    "DeviceNotPluggedIn": "Unable to mount developer disk image.",
    "DeveloperDiskImgNotMountable": "Unable to mount developer disk image.",
    "UnableToLaunchApplication": "Unable to launch application.",
    "ApplicationLaunchTimedOut": "Timeout launching application. Is the device locked?",
    "IOSSimulatorNotLaunchable": "Unable to launch iOS simulator. Try specifying a different target.",
    "OpnPackagerLocationNotFound": "opn package location not found",
    "PackageNotFound": "Attempting to find package {0} failed with error: {1}",
    "PlatformNotSupported": "Platform '{0}' is not supported on host platform: {1}",
    "ProjectVersionNotParsable": "Couldn't parse the version component of the package at {0}: version = {1}",
    "ProjectVersionUnsupported": "Project version = {0}",
    "ProjectVersionNotReadable": "Unable to read version = {0}",
    "TelemetryInitializationFailed": "{0}. Couldn't initialize telemetry",
    "ExtensionActivationFailed": "Failed to activate the React Native Tools extension",
    "DebuggerStubLauncherFailed": "Failed to setup the stub launcher for the debugger",
    "IntellisenseSetupFailed": "Failed to setup IntelliSense",
    "NodeDebuggerConfigurationFailed": "Failed to configure the node debugger location for the debugger",
    "FailedToStopPackagerOnExit": "Failed to stop the packager while closing React Native Tools",
    "FailedToRunOnAndroid": "Failed to run the application in Android",
    "FailedToRunOnIos": "Failed to run the application in iOS",
    "FailedToStartPackager": "Failed to start the React Native packager",
    "FailedToStopPackager": "Failed to stop the React Native packager",
    "FailedToRestartPackager": "Failed to restart the React Native packager",
    "DebuggingFailed": "Cannot debug application",
    "DebuggingFailedInNodeWrapper": "Cannot debug application due to an error in the internal Node Debugger",
    "RNTempFolderDeletionFailed": "Couldn't delete the temporary folder {0}",
    "CouldNotFindLocationOfNodeDebugger": "Couldn't find the location of the node-debugger extension",
    "PackagerRunningInDifferentPort": "A packager cannot be started on port {0} because a packager process is already running on port {1}",
    "ErrorWhileProcessingMessageInIPMSServer": "An error ocurred while handling message: {0}",
    "ErrorNoPipeFound": "Unable to set up communication with VSCode react-native extension. Is this a react-native project, and have you made sure that the react-native npm package is installed at the root?",
};

//# sourceMappingURL=errorStrings.js.map
