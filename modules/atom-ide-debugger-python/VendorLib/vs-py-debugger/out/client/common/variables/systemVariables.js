/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const Path = require("path");
const Types = require("../utils/sysTypes");
/* tslint:disable:rule1 no-any no-unnecessary-callback-wrapper jsdoc-format no-for-in prefer-const no-increment-decrement */
class AbstractSystemVariables {
    // tslint:disable-next-line:no-any
    resolve(value) {
        if (Types.isString(value)) {
            return this.__resolveString(value);
        }
        else if (Types.isArray(value)) {
            return this.__resolveArray(value);
        }
        else if (Types.isObject(value)) {
            return this.__resolveLiteral(value);
        }
        return value;
    }
    // tslint:disable-next-line:no-any
    resolveAny(value) {
        if (Types.isString(value)) {
            return this.__resolveString(value);
        }
        else if (Types.isArray(value)) {
            return this.__resolveAnyArray(value);
        }
        else if (Types.isObject(value)) {
            return this.__resolveAnyLiteral(value);
        }
        return value;
    }
    __resolveString(value) {
        const regexp = /\$\{(.*?)\}/g;
        return value.replace(regexp, (match, name) => {
            // tslint:disable-next-line:no-any
            const newValue = this[name];
            if (Types.isString(newValue)) {
                return newValue;
            }
            else {
                return match && (match.indexOf('env.') > 0 || match.indexOf('env:') > 0) ? '' : match;
            }
        });
    }
    __resolveLiteral(values) {
        const result = Object.create(null);
        Object.keys(values).forEach(key => {
            const value = values[key];
            // tslint:disable-next-line:no-any
            result[key] = this.resolve(value);
        });
        return result;
    }
    // tslint:disable-next-line:no-any
    __resolveAnyLiteral(values) {
        const result = Object.create(null);
        Object.keys(values).forEach(key => {
            const value = values[key];
            // tslint:disable-next-line:no-any
            result[key] = this.resolveAny(value);
        });
        return result;
    }
    __resolveArray(value) {
        return value.map(s => this.__resolveString(s));
    }
    // tslint:disable-next-line:no-any
    __resolveAnyArray(value) {
        return value.map(s => this.resolveAny(s));
    }
}
exports.AbstractSystemVariables = AbstractSystemVariables;
class SystemVariables extends AbstractSystemVariables {
    constructor(workspaceFolder) {
        super();
        this._workspaceFolder = typeof workspaceFolder === 'string' ? workspaceFolder : __dirname;
        this._workspaceFolderName = Path.basename(this._workspaceFolder);
        Object.keys(process.env).forEach(key => {
            this[`env:${key}`] = this[`env.${key}`] = process.env[key];
        });
    }
    get cwd() {
        return this.workspaceFolder;
    }
    get workspaceRoot() {
        return this._workspaceFolder;
    }
    get workspaceFolder() {
        return this._workspaceFolder;
    }
    get workspaceRootFolderName() {
        return this._workspaceFolderName;
    }
    get workspaceFolderBasename() {
        return this._workspaceFolderName;
    }
}
exports.SystemVariables = SystemVariables;
//# sourceMappingURL=systemVariables.js.map