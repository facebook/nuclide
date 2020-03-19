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
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const path = require("path");
const types_1 = require("../common/types");
const types_2 = require("../ioc/types");
let FormatterHelper = class FormatterHelper {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    translateToId(formatter) {
        switch (formatter) {
            case types_1.Product.autopep8: return 'autopep8';
            case types_1.Product.black: return 'black';
            case types_1.Product.yapf: return 'yapf';
            default: {
                throw new Error(`Unrecognized Formatter '${formatter}'`);
            }
        }
    }
    getSettingsPropertyNames(formatter) {
        const id = this.translateToId(formatter);
        return {
            argsName: `${id}Args`,
            pathName: `${id}Path`
        };
    }
    getExecutionInfo(formatter, customArgs, resource) {
        const settings = this.serviceContainer.get(types_1.IConfigurationService).getSettings(resource);
        const names = this.getSettingsPropertyNames(formatter);
        const execPath = settings.formatting[names.pathName];
        let args = Array.isArray(settings.formatting[names.argsName]) ? settings.formatting[names.argsName] : [];
        args = args.concat(customArgs);
        let moduleName;
        // If path information is not available, then treat it as a module,
        if (path.basename(execPath) === execPath) {
            moduleName = execPath;
        }
        return { execPath, moduleName, args, product: formatter };
    }
};
FormatterHelper = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], FormatterHelper);
exports.FormatterHelper = FormatterHelper;
//# sourceMappingURL=helper.js.map