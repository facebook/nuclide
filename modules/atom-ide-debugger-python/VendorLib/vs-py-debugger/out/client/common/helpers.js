// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
const moduleNotInstalledError_1 = require("./errors/moduleNotInstalledError");
function isNotInstalledError(error) {
    const isError = typeof (error) === 'object' && error !== null;
    // tslint:disable-next-line:no-any
    const errorObj = error;
    if (!isError) {
        return false;
    }
    if (error instanceof moduleNotInstalledError_1.ModuleNotInstalledError) {
        return true;
    }
    const isModuleNoInstalledError = error.message.indexOf('No module named') >= 0;
    return errorObj.code === 'ENOENT' || errorObj.code === 127 || isModuleNoInstalledError;
}
exports.isNotInstalledError = isNotInstalledError;
function skipIfTest(isAsyncFunction) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (_, __, descriptor) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args) {
            if (constants_1.isTestExecution()) {
                return isAsyncFunction ? Promise.resolve() : undefined;
            }
            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            return originalMethod.apply(this, args);
        };
        return descriptor;
    };
}
exports.skipIfTest = skipIfTest;
//# sourceMappingURL=helpers.js.map