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
const types_1 = require("../../ioc/types");
const types_2 = require("../application/types");
const types_3 = require("../process/types");
const moduleInstaller_1 = require("./moduleInstaller");
let PipInstaller = class PipInstaller extends moduleInstaller_1.ModuleInstaller {
    constructor(serviceContainer) {
        super(serviceContainer);
    }
    get displayName() {
        return 'Pip';
    }
    get priority() {
        return 0;
    }
    isSupported(resource) {
        return this.isPipAvailable(resource);
    }
    getExecutionInfo(moduleName, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const proxyArgs = [];
            const workspaceService = this.serviceContainer.get(types_2.IWorkspaceService);
            const proxy = workspaceService.getConfiguration('http').get('proxy', '');
            if (proxy.length > 0) {
                proxyArgs.push('--proxy');
                proxyArgs.push(proxy);
            }
            return {
                args: [...proxyArgs, 'install', '-U', moduleName],
                moduleName: 'pip'
            };
        });
    }
    isPipAvailable(resource) {
        const pythonExecutionFactory = this.serviceContainer.get(types_3.IPythonExecutionFactory);
        return pythonExecutionFactory.create({ resource })
            .then(proc => proc.isModuleInstalled('pip'))
            .catch(() => false);
    }
};
PipInstaller = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], PipInstaller);
exports.PipInstaller = PipInstaller;
//# sourceMappingURL=pipInstaller.js.map