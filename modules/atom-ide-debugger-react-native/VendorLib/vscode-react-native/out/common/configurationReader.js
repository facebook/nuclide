"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const internalErrorCode_1 = require("./error/internalErrorCode");
const errorHelper_1 = require("./error/errorHelper");
class ConfigurationReader {
    static readString(value) {
        if (this.isString(value)) {
            return value;
        }
        else {
            throw errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.ExpectedStringValue, value);
        }
    }
    static readBoolean(value) {
        if (this.isBoolean(value)) {
            return value;
        }
        else if (value === "true" || value === "false") {
            return value === "true";
        }
        else {
            throw errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.ExpectedBooleanValue, value);
        }
    }
    static readArray(value) {
        if (this.isArray(value)) {
            return value;
        }
        else {
            throw errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.ExpectedArrayValue, value);
        }
    }
    static readObject(value) {
        if (this.isObject(value)) {
            return value;
        }
        else {
            throw errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.ExpectedObjectValue, value);
        }
    }
    /* We try to read an integer. It can be either an integer, or a string that can be parsed as an integer */
    static readInt(value) {
        if (this.isInt(value)) {
            return value;
        }
        else if (this.isString(value)) {
            return parseInt(value, 10);
        }
        else {
            throw errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.ExpectedIntegerValue, value);
        }
    }
    /* We try to read an integer. If it's a falsable value we return the default value, if not we behave like this.readInt(value)
      If the value is provided but it can't be parsed we'll throw an exception so the user knows that we didn't understand
      the value that was provided */
    static readIntWithDefaultSync(value, defaultValue) {
        return value ? this.readInt(value) : defaultValue;
    }
    static readIntWithDefaultAsync(value, defaultValuePromise) {
        return defaultValuePromise.then(defaultValue => {
            return this.readIntWithDefaultSync(value, defaultValue);
        });
    }
    static isArray(value) {
        return Array.isArray(value);
    }
    static isObject(value) {
        return typeof value === "object" || !ConfigurationReader.isArray(value);
    }
    static isString(value) {
        return typeof value === "string";
    }
    static isBoolean(value) {
        return typeof value === "boolean";
    }
    static isInt(value) {
        return this.isNumber(value) && value % 1 === 0;
    }
    static isNumber(value) {
        return typeof value === "number";
    }
}
exports.ConfigurationReader = ConfigurationReader;

//# sourceMappingURL=configurationReader.js.map
