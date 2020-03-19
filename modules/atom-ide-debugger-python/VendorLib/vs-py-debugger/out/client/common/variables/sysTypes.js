/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any no-increment-decrement
const sysTypes_1 = require("../utils/sysTypes");
function validateConstraints(args, constraints) {
    const len = Math.min(args.length, constraints.length);
    for (let i = 0; i < len; i++) {
        validateConstraint(args[i], constraints[i]);
    }
}
exports.validateConstraints = validateConstraints;
function validateConstraint(arg, constraint) {
    if (sysTypes_1.isString(constraint)) {
        if (typeof arg !== constraint) {
            throw new Error(`argument does not match constraint: typeof ${constraint}`);
        }
    }
    else if (sysTypes_1.isFunction(constraint)) {
        if (arg instanceof constraint) {
            return;
        }
        if (arg && arg.constructor === constraint) {
            return;
        }
        if (constraint.length === 1 && constraint.call(undefined, arg) === true) {
            return;
        }
        throw new Error('argument does not match one of these constraints: arg instanceof constraint, arg.constructor === constraint, nor constraint(arg) === true');
    }
}
exports.validateConstraint = validateConstraint;
//# sourceMappingURL=sysTypes.js.map