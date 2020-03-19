/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:rule1 no-any no-unnecessary-callback-wrapper jsdoc-format no-for-in prefer-const no-increment-decrement
const _typeof = {
    number: 'number',
    string: 'string',
    undefined: 'undefined',
    object: 'object',
    function: 'function'
};
/**
 * @returns whether the provided parameter is a JavaScript Array or not.
 */
function isArray(array) {
    if (Array.isArray) {
        return Array.isArray(array);
    }
    if (array && typeof (array.length) === _typeof.number && array.constructor === Array) {
        return true;
    }
    return false;
}
exports.isArray = isArray;
/**
 * @returns whether the provided parameter is a JavaScript String or not.
 */
function isString(str) {
    if (typeof (str) === _typeof.string || str instanceof String) {
        return true;
    }
    return false;
}
exports.isString = isString;
/**
 * @returns whether the provided parameter is a JavaScript Array and each element in the array is a string.
 */
function isStringArray(value) {
    return isArray(value) && value.every(elem => isString(elem));
}
exports.isStringArray = isStringArray;
/**
 *
 * @returns whether the provided parameter is of type `object` but **not**
 *	`null`, an `array`, a `regexp`, nor a `date`.
 */
function isObject(obj) {
    return typeof obj === _typeof.object
        && obj !== null
        && !Array.isArray(obj)
        && !(obj instanceof RegExp)
        && !(obj instanceof Date);
}
exports.isObject = isObject;
/**
 * In **contrast** to just checking `typeof` this will return `false` for `NaN`.
 * @returns whether the provided parameter is a JavaScript Number or not.
 */
function isNumber(obj) {
    if ((typeof (obj) === _typeof.number || obj instanceof Number) && !isNaN(obj)) {
        return true;
    }
    return false;
}
exports.isNumber = isNumber;
/**
 * @returns whether the provided parameter is a JavaScript Boolean or not.
 */
function isBoolean(obj) {
    return obj === true || obj === false;
}
exports.isBoolean = isBoolean;
/**
 * @returns whether the provided parameter is undefined.
 */
function isUndefined(obj) {
    return typeof (obj) === _typeof.undefined;
}
exports.isUndefined = isUndefined;
/**
 * @returns whether the provided parameter is undefined or null.
 */
function isUndefinedOrNull(obj) {
    return isUndefined(obj) || obj === null;
}
exports.isUndefinedOrNull = isUndefinedOrNull;
const hasOwnProperty = Object.prototype.hasOwnProperty;
/**
 * @returns whether the provided parameter is an empty JavaScript Object or not.
 */
function isEmptyObject(obj) {
    if (!isObject(obj)) {
        return false;
    }
    for (let key in obj) {
        if (hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}
exports.isEmptyObject = isEmptyObject;
/**
 * @returns whether the provided parameter is a JavaScript Function or not.
 */
function isFunction(obj) {
    return typeof obj === _typeof.function;
}
exports.isFunction = isFunction;
/**
 * @returns whether the provided parameters is are JavaScript Function or not.
 */
function areFunctions(...objects) {
    return objects && objects.length > 0 && objects.every(isFunction);
}
exports.areFunctions = areFunctions;
//# sourceMappingURL=sysTypes.js.map