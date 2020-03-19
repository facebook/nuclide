"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const fs = require("fs-extra");
const inversify_1 = require("inversify");
const path = require("path");
const types_1 = require("../types");
let EnvironmentVariablesService = class EnvironmentVariablesService {
    constructor(pathUtils) {
        this.pathVariable = pathUtils.getPathVariableName();
    }
    parseFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield fs.pathExists(filePath);
            if (!exists) {
                return undefined;
            }
            if (!fs.lstatSync(filePath).isFile()) {
                return undefined;
            }
            return dotenv.parse(yield fs.readFile(filePath));
        });
    }
    mergeVariables(source, target) {
        if (!target) {
            return;
        }
        const settingsNotToMerge = ['PYTHONPATH', this.pathVariable];
        Object.keys(source).forEach(setting => {
            if (settingsNotToMerge.indexOf(setting) >= 0) {
                return;
            }
            if (target[setting] === undefined) {
                target[setting] = source[setting];
            }
        });
    }
    appendPythonPath(vars, ...pythonPaths) {
        return this.appendPaths(vars, 'PYTHONPATH', ...pythonPaths);
    }
    appendPath(vars, ...paths) {
        return this.appendPaths(vars, this.pathVariable, ...paths);
    }
    appendPaths(vars, variableName, ...pathsToAppend) {
        const valueToAppend = pathsToAppend
            .filter(item => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim())
            .join(path.delimiter);
        if (valueToAppend.length === 0) {
            return vars;
        }
        if (typeof vars[variableName] === 'string' && vars[variableName].length > 0) {
            vars[variableName] = vars[variableName] + path.delimiter + valueToAppend;
        }
        else {
            vars[variableName] = valueToAppend;
        }
        return vars;
    }
};
EnvironmentVariablesService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IPathUtils))
], EnvironmentVariablesService);
exports.EnvironmentVariablesService = EnvironmentVariablesService;
//# sourceMappingURL=environment.js.map