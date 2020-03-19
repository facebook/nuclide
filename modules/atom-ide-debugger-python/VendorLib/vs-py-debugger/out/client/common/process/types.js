"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IBufferDecoder = Symbol('IBufferDecoder');
exports.IProcessServiceFactory = Symbol('IProcessServiceFactory');
exports.IPythonExecutionFactory = Symbol('IPythonExecutionFactory');
exports.IPythonExecutionService = Symbol('IPythonExecutionService');
class StdErrError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.StdErrError = StdErrError;
exports.IPythonToolExecutionService = Symbol('IPythonToolRunnerService');
//# sourceMappingURL=types.js.map