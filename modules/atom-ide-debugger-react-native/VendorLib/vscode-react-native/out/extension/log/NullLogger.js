"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
class NullLogger {
    log(message, level) { }
    info(message) { }
    warning(message) { }
    error(errorMessage, error, stack) { }
    debug(message) { }
    logStream(data, stream) { }
}
exports.NullLogger = NullLogger;

//# sourceMappingURL=NullLogger.js.map
