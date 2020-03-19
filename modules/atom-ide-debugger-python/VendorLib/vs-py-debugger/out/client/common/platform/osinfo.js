// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const platform_1 = require("../utils/platform");
const constants_1 = require("./constants");
function getPathVariableName(info) {
    return platform_1.isWindows(info) ? constants_1.WINDOWS_PATH_VARIABLE_NAME : constants_1.NON_WINDOWS_PATH_VARIABLE_NAME;
}
exports.getPathVariableName = getPathVariableName;
function getVirtualEnvBinName(info) {
    return platform_1.isWindows(info) ? 'scripts' : 'bin';
}
exports.getVirtualEnvBinName = getVirtualEnvBinName;
//# sourceMappingURL=osinfo.js.map