/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:all
var vscMockStrings;
(function (vscMockStrings) {
    /**
     * Determines if haystack starts with needle.
     */
    function startsWith(haystack, needle) {
        if (haystack.length < needle.length) {
            return false;
        }
        for (let i = 0; i < needle.length; i++) {
            if (haystack[i] !== needle[i]) {
                return false;
            }
        }
        return true;
    }
    vscMockStrings.startsWith = startsWith;
    /**
     * Determines if haystack ends with needle.
     */
    function endsWith(haystack, needle) {
        let diff = haystack.length - needle.length;
        if (diff > 0) {
            return haystack.indexOf(needle, diff) === diff;
        }
        else if (diff === 0) {
            return haystack === needle;
        }
        else {
            return false;
        }
    }
    vscMockStrings.endsWith = endsWith;
})(vscMockStrings = exports.vscMockStrings || (exports.vscMockStrings = {}));
//# sourceMappingURL=strings.js.map