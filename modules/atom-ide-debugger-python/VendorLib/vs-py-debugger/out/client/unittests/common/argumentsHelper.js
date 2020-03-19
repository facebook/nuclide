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
const types_1 = require("../../common/types");
const types_2 = require("../../ioc/types");
let ArgumentsHelper = class ArgumentsHelper {
    constructor(serviceContainer) {
        this.logger = serviceContainer.get(types_1.ILogger);
    }
    getOptionValues(args, option) {
        const values = [];
        let returnNextValue = false;
        for (const arg of args) {
            if (returnNextValue) {
                values.push(arg);
                returnNextValue = false;
                continue;
            }
            if (arg.startsWith(`${option}=`)) {
                values.push(arg.substring(`${option}=`.length));
                continue;
            }
            if (arg === option) {
                returnNextValue = true;
            }
        }
        switch (values.length) {
            case 0: {
                return;
            }
            case 1: {
                return values[0];
            }
            default: {
                return values;
            }
        }
    }
    getPositionalArguments(args, optionsWithArguments = [], optionsWithoutArguments = []) {
        let lastIndexOfOption = -1;
        args.forEach((arg, index) => {
            if (optionsWithoutArguments.indexOf(arg) !== -1) {
                lastIndexOfOption = index;
                return;
            }
            else if (optionsWithArguments.indexOf(arg) !== -1) {
                // Cuz the next item is the value.
                lastIndexOfOption = index + 1;
            }
            else if (optionsWithArguments.findIndex(item => arg.startsWith(`${item}=`)) !== -1) {
                lastIndexOfOption = index;
                return;
            }
            else if (arg.startsWith('-')) {
                // Ok this is an unknown option, lets treat this as one without values.
                this.logger.logWarning(`Unknown command line option passed into args parser for tests '${arg}'. Please report on https://github.com/Microsoft/vscode-python/issues/new`);
                lastIndexOfOption = index;
                return;
            }
            else if (args.indexOf('=') > 0) {
                // Ok this is an unknown option with a value
                this.logger.logWarning(`Unknown command line option passed into args parser for tests '${arg}'. Please report on https://github.com/Microsoft/vscode-python/issues/new`);
                lastIndexOfOption = index;
            }
        });
        return args.slice(lastIndexOfOption + 1);
    }
    filterArguments(args, optionsWithArguments = [], optionsWithoutArguments = []) {
        let ignoreIndex = -1;
        return args.filter((arg, index) => {
            if (ignoreIndex === index) {
                return false;
            }
            // Options can use willd cards (with trailing '*')
            if (optionsWithoutArguments.indexOf(arg) >= 0 ||
                optionsWithoutArguments.filter(option => option.endsWith('*') && arg.startsWith(option.slice(0, -1))).length > 0) {
                return false;
            }
            // Ignore args that match exactly.
            if (optionsWithArguments.indexOf(arg) >= 0) {
                ignoreIndex = index + 1;
                return false;
            }
            // Ignore args that match exactly with wild cards & do not have inline values.
            if (optionsWithArguments.filter(option => arg.startsWith(`${option}=`)).length > 0) {
                return false;
            }
            // Ignore args that match a wild card (ending with *) and no ineline values.
            // Eg. arg='--log-cli-level' and optionsArguments=['--log-*']
            if (arg.indexOf('=') === -1 && optionsWithoutArguments.filter(option => option.endsWith('*') && arg.startsWith(option.slice(0, -1))).length > 0) {
                ignoreIndex = index + 1;
                return false;
            }
            // Ignore args that match a wild card (ending with *) and have ineline values.
            // Eg. arg='--log-cli-level=XYZ' and optionsArguments=['--log-*']
            if (arg.indexOf('=') >= 0 && optionsWithoutArguments.filter(option => option.endsWith('*') && arg.startsWith(option.slice(0, -1))).length > 0) {
                return false;
            }
            return true;
        });
    }
};
ArgumentsHelper = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], ArgumentsHelper);
exports.ArgumentsHelper = ArgumentsHelper;
//# sourceMappingURL=argumentsHelper.js.map