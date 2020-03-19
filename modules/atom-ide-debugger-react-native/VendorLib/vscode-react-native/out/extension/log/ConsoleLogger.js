"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const LogHelper_1 = require("./LogHelper");
class ConsoleLogger {
    log(message, level) {
        if (LogHelper_1.LogHelper.LOG_LEVEL === LogHelper_1.LogLevel.None) {
            return;
        }
        if (level >= LogHelper_1.LogHelper.LOG_LEVEL) {
            message = ConsoleLogger.getFormattedMessage(message, level);
            console.log(message);
        }
    }
    info(message) {
        this.log(message, LogHelper_1.LogLevel.Info);
    }
    warning(message, logStack = false) {
        this.log(message, LogHelper_1.LogLevel.Warning);
    }
    error(errorMessage, error, logStack = true) {
        console.error(ConsoleLogger.getFormattedMessage(errorMessage, LogHelper_1.LogLevel.Error));
        // Print the error stack if necessary
        if (logStack && error && error.stack) {
            console.error(`Stack: ${error.stack}`);
        }
    }
    debug(message) {
        this.log(message, LogHelper_1.LogLevel.Debug);
    }
    logStream(data, stream) {
        stream.write(data.toString());
    }
    static getFormattedMessage(message, level) {
        return `[${LogHelper_1.LogLevel[level]}] ${message}\n`;
    }
}
exports.ConsoleLogger = ConsoleLogger;

//# sourceMappingURL=ConsoleLogger.js.map
