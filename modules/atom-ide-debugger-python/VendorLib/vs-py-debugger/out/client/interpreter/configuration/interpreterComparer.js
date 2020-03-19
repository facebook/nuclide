// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const registry_1 = require("../../common/platform/registry");
const contracts_1 = require("../contracts");
let InterpreterComparer = class InterpreterComparer {
    constructor(interpreterHelper) {
        this.interpreterHelper = interpreterHelper;
    }
    compare(a, b) {
        const nameA = this.getSortName(a);
        const nameB = this.getSortName(b);
        if (nameA === nameB) {
            return 0;
        }
        return nameA > nameB ? 1 : -1;
    }
    getSortName(info) {
        const sortNameParts = [];
        const envSuffixParts = [];
        // Sort order for interpreters is:
        // * Version
        // * Architecture
        // * Interpreter Type
        // * Environment name
        if (info.version_info && info.version_info.length > 0) {
            sortNameParts.push(info.version_info.slice(0, 3).join('.'));
        }
        if (info.architecture) {
            sortNameParts.push(registry_1.getArchitectureDisplayName(info.architecture));
        }
        if (info.companyDisplayName && info.companyDisplayName.length > 0) {
            sortNameParts.push(info.companyDisplayName.trim());
        }
        else {
            sortNameParts.push('Python');
        }
        if (info.type) {
            const name = this.interpreterHelper.getInterpreterTypeDisplayName(info.type);
            if (name) {
                envSuffixParts.push(name);
            }
        }
        if (info.envName && info.envName.length > 0) {
            envSuffixParts.push(info.envName);
        }
        const envSuffix = envSuffixParts.length === 0 ? '' :
            `(${envSuffixParts.join(': ')})`;
        return `${sortNameParts.join(' ')} ${envSuffix}`.trim();
    }
};
InterpreterComparer = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(contracts_1.IInterpreterHelper))
], InterpreterComparer);
exports.InterpreterComparer = InterpreterComparer;
//# sourceMappingURL=interpreterComparer.js.map