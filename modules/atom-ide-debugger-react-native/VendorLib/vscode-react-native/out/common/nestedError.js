"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
class NestedError extends Error {
    constructor(message, innerError, extras) {
        super(message);
        this._innerError = innerError;
        this.name = innerError.name;
        const innerMessage = innerError.message;
        this.message = innerMessage ? `${message}: ${innerMessage}` : message;
        this._extras = extras;
    }
    get extras() {
        return this._extras;
    }
}
exports.NestedError = NestedError;

//# sourceMappingURL=nestedError.js.map
