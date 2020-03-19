"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
class ModuleNotInstalledError extends Error {
    constructor(moduleName) {
        super(`Module '${moduleName}' not installed.`);
    }
}
exports.ModuleNotInstalledError = ModuleNotInstalledError;
//# sourceMappingURL=moduleNotInstalledError.js.map