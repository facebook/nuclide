// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
function formatErrorForLogging(error) {
    let message = '';
    if (typeof error === 'string') {
        message = error;
    }
    else {
        if (error.message) {
            message = `Error Message: ${error.message}`;
        }
        if (error.name && error.message.indexOf(error.name) === -1) {
            message += `, (${error.name})`;
        }
        // tslint:disable-next-line:no-any
        const innerException = error.innerException;
        if (innerException && (innerException.message || innerException.name)) {
            if (innerException.message) {
                message += `, Inner Error Message: ${innerException.message}`;
            }
            if (innerException.name && innerException.message.indexOf(innerException.name) === -1) {
                message += `, (${innerException.name})`;
            }
        }
    }
    return message;
}
exports.formatErrorForLogging = formatErrorForLogging;
//# sourceMappingURL=logging.js.map