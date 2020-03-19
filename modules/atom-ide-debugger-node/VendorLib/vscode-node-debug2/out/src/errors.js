"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const nls = require("vscode-nls");
const localize = nls.config(process.env.VSCODE_NLS_CONFIG)(__filename);
function runtimeNotFound(_runtime) {
    return {
        id: 2001,
        format: localize(0, null, '{_runtime}'),
        variables: { _runtime }
    };
}
exports.runtimeNotFound = runtimeNotFound;
function cannotLaunchInTerminal(_error) {
    return {
        id: 2011,
        format: localize(1, null, '{_error}'),
        variables: { _error }
    };
}
exports.cannotLaunchInTerminal = cannotLaunchInTerminal;
function cannotLaunchDebugTarget(_error) {
    return {
        id: 2017,
        format: localize(2, null, '{_error}'),
        variables: { _error },
        showUser: true,
        sendTelemetry: true
    };
}
exports.cannotLaunchDebugTarget = cannotLaunchDebugTarget;
function unknownConsoleType(consoleType) {
    return {
        id: 2028,
        format: localize(3, null, consoleType)
    };
}
exports.unknownConsoleType = unknownConsoleType;
function cannotLaunchBecauseSourceMaps(programPath) {
    return {
        id: 2002,
        format: localize(4, null, '{path}'),
        variables: { path: programPath }
    };
}
exports.cannotLaunchBecauseSourceMaps = cannotLaunchBecauseSourceMaps;
function cannotLaunchBecauseOutFiles(programPath) {
    return {
        id: 2003,
        format: localize(5, null, '{path}', 'outFiles'),
        variables: { path: programPath }
    };
}
exports.cannotLaunchBecauseOutFiles = cannotLaunchBecauseOutFiles;
function cannotLaunchBecauseJsNotFound(programPath) {
    return {
        id: 2009,
        format: localize(6, null, '{path}'),
        variables: { path: programPath }
    };
}
exports.cannotLaunchBecauseJsNotFound = cannotLaunchBecauseJsNotFound;
function cannotLoadEnvVarsFromFile(error) {
    return {
        id: 2029,
        format: localize(7, null, '{_error}'),
        variables: { _error: error }
    };
}
exports.cannotLoadEnvVarsFromFile = cannotLoadEnvVarsFromFile;

//# sourceMappingURL=errors.js.map
