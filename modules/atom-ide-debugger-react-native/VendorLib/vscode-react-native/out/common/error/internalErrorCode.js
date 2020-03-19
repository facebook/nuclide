"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
var InternalErrorCode;
(function (InternalErrorCode) {
    // Command Executor errors
    InternalErrorCode[InternalErrorCode["CommandFailed"] = 101] = "CommandFailed";
    InternalErrorCode[InternalErrorCode["CommandFailedWithErrorCode"] = 102] = "CommandFailedWithErrorCode";
    InternalErrorCode[InternalErrorCode["PackagerStartFailed"] = 103] = "PackagerStartFailed";
    InternalErrorCode[InternalErrorCode["FailedToRunOnAndroid"] = 104] = "FailedToRunOnAndroid";
    InternalErrorCode[InternalErrorCode["FailedToRunOnIos"] = 105] = "FailedToRunOnIos";
    InternalErrorCode[InternalErrorCode["FailedToStartPackager"] = 106] = "FailedToStartPackager";
    InternalErrorCode[InternalErrorCode["FailedToStopPackager"] = 107] = "FailedToStopPackager";
    InternalErrorCode[InternalErrorCode["PackagerRunningInDifferentPort"] = 108] = "PackagerRunningInDifferentPort";
    InternalErrorCode[InternalErrorCode["FailedToRestartPackager"] = 109] = "FailedToRestartPackager";
    InternalErrorCode[InternalErrorCode["FailedToStartExponentPackager"] = 110] = "FailedToStartExponentPackager";
    InternalErrorCode[InternalErrorCode["FailedToPublishToExpHost"] = 111] = "FailedToPublishToExpHost";
    // Device Deployer errors
    InternalErrorCode[InternalErrorCode["IOSDeployNotFound"] = 201] = "IOSDeployNotFound";
    // Device Runner errors
    InternalErrorCode[InternalErrorCode["DeviceNotPluggedIn"] = 301] = "DeviceNotPluggedIn";
    InternalErrorCode[InternalErrorCode["DeveloperDiskImgNotMountable"] = 302] = "DeveloperDiskImgNotMountable";
    InternalErrorCode[InternalErrorCode["UnableToLaunchApplication"] = 303] = "UnableToLaunchApplication";
    InternalErrorCode[InternalErrorCode["ApplicationLaunchTimedOut"] = 304] = "ApplicationLaunchTimedOut";
    // iOS Platform errors
    InternalErrorCode[InternalErrorCode["IOSSimulatorNotLaunchable"] = 401] = "IOSSimulatorNotLaunchable";
    // Packager errors
    InternalErrorCode[InternalErrorCode["OpnPackagerLocationNotFound"] = 501] = "OpnPackagerLocationNotFound";
    InternalErrorCode[InternalErrorCode["OpnPackagerNotFound"] = 502] = "OpnPackagerNotFound";
    InternalErrorCode[InternalErrorCode["FailedToStopPackagerOnExit"] = 503] = "FailedToStopPackagerOnExit";
    // React Native Project errors
    InternalErrorCode[InternalErrorCode["ProjectVersionNotParsable"] = 601] = "ProjectVersionNotParsable";
    InternalErrorCode[InternalErrorCode["ProjectVersionUnsupported"] = 602] = "ProjectVersionUnsupported";
    InternalErrorCode[InternalErrorCode["ProjectVersionNotReadable"] = 603] = "ProjectVersionNotReadable";
    // Miscellaneous errors
    InternalErrorCode[InternalErrorCode["TelemetryInitializationFailed"] = 701] = "TelemetryInitializationFailed";
    InternalErrorCode[InternalErrorCode["ExtensionActivationFailed"] = 702] = "ExtensionActivationFailed";
    InternalErrorCode[InternalErrorCode["DebuggerStubLauncherFailed"] = 703] = "DebuggerStubLauncherFailed";
    InternalErrorCode[InternalErrorCode["IntellisenseSetupFailed"] = 704] = "IntellisenseSetupFailed";
    InternalErrorCode[InternalErrorCode["NodeDebuggerConfigurationFailed"] = 705] = "NodeDebuggerConfigurationFailed";
    InternalErrorCode[InternalErrorCode["DebuggingFailed"] = 706] = "DebuggingFailed";
    InternalErrorCode[InternalErrorCode["RNTempFolderDeletionFailed"] = 707] = "RNTempFolderDeletionFailed";
    InternalErrorCode[InternalErrorCode["DebuggingFailedInNodeWrapper"] = 708] = "DebuggingFailedInNodeWrapper";
    InternalErrorCode[InternalErrorCode["PlatformNotSupported"] = 709] = "PlatformNotSupported";
    InternalErrorCode[InternalErrorCode["WorkspaceNotFound"] = 710] = "WorkspaceNotFound";
    InternalErrorCode[InternalErrorCode["ExpectedExponentTunnelPath"] = 711] = "ExpectedExponentTunnelPath";
    // Activation errors
    InternalErrorCode[InternalErrorCode["CouldNotFindLocationOfNodeDebugger"] = 801] = "CouldNotFindLocationOfNodeDebugger";
    // Validating user input errors
    InternalErrorCode[InternalErrorCode["ExpectedIntegerValue"] = 1001] = "ExpectedIntegerValue";
    InternalErrorCode[InternalErrorCode["ExpectedStringValue"] = 1002] = "ExpectedStringValue";
    InternalErrorCode[InternalErrorCode["ExpectedBooleanValue"] = 1003] = "ExpectedBooleanValue";
    InternalErrorCode[InternalErrorCode["ExpectedArrayValue"] = 1004] = "ExpectedArrayValue";
    InternalErrorCode[InternalErrorCode["ExpectedObjectValue"] = 1005] = "ExpectedObjectValue";
    // Inter Process Communication errors
    InternalErrorCode[InternalErrorCode["ErrorWhileProcessingMessageInIPMSServer"] = 901] = "ErrorWhileProcessingMessageInIPMSServer";
    InternalErrorCode[InternalErrorCode["ErrorNoPipeFound"] = 902] = "ErrorNoPipeFound";
})(InternalErrorCode = exports.InternalErrorCode || (exports.InternalErrorCode = {}));

//# sourceMappingURL=internalErrorCode.js.map
