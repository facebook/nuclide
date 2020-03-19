"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Logging utility class.
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["Trace"] = 0] = "Trace";
    LogLevel[LogLevel["Debug"] = 1] = "Debug";
    LogLevel[LogLevel["Info"] = 2] = "Info";
    LogLevel[LogLevel["Warning"] = 3] = "Warning";
    LogLevel[LogLevel["Error"] = 4] = "Error";
    LogLevel[LogLevel["None"] = 5] = "None";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class LogHelper {
    static get LOG_LEVEL() {
        return getLogLevel();
    }
}
exports.LogHelper = LogHelper;
function getLogLevel() {
    try {
        const SettingsHelper = require("../settingsHelper").SettingsHelper;
        return SettingsHelper.getLogLevel();
    }
    catch (err) {
        return LogLevel.Info; // Default
    }
}

//# sourceMappingURL=LogHelper.js.map
