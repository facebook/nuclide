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
const inversify_1 = require("inversify");
const contracts_1 = require("../../interpreter/contracts");
const types_1 = require("../../ioc/types");
const moduleInstaller_1 = require("./moduleInstaller");
exports.pipenvName = 'pipenv';
let PipEnvInstaller = class PipEnvInstaller extends moduleInstaller_1.ModuleInstaller {
    constructor(serviceContainer) {
        super(serviceContainer);
        this.pipenv = this.serviceContainer.get(contracts_1.IInterpreterLocatorService, contracts_1.PIPENV_SERVICE);
    }
    get displayName() {
        return exports.pipenvName;
    }
    get priority() {
        return 10;
    }
    isSupported(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpreters = yield this.pipenv.getInterpreters(resource);
            return interpreters && interpreters.length > 0;
        });
    }
    getExecutionInfo(moduleName, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                args: ['install', moduleName, '--dev'],
                execPath: exports.pipenvName
            };
        });
    }
};
PipEnvInstaller = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], PipEnvInstaller);
exports.PipEnvInstaller = PipEnvInstaller;
//# sourceMappingURL=pipEnvInstaller.js.map