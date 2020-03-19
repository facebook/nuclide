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
const types_2 = require("./types");
let PythonToolExecutionService = class PythonToolExecutionService {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    execObservable(executionInfo, options, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (options.env) {
                throw new Error('Environment variables are not supported');
            }
            if (executionInfo.moduleName && executionInfo.moduleName.length > 0) {
                const pythonExecutionService = yield this.serviceContainer.get(types_2.IPythonExecutionFactory).create({ resource });
                return pythonExecutionService.execModuleObservable(executionInfo.moduleName, executionInfo.args, options);
            }
            else {
                const processService = yield this.serviceContainer.get(types_2.IProcessServiceFactory).create(resource);
                return processService.execObservable(executionInfo.execPath, executionInfo.args, Object.assign({}, options));
            }
        });
    }
    exec(executionInfo, options, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (options.env) {
                throw new Error('Environment variables are not supported');
            }
            if (executionInfo.moduleName && executionInfo.moduleName.length > 0) {
                const pythonExecutionService = yield this.serviceContainer.get(types_2.IPythonExecutionFactory).create({ resource });
                return pythonExecutionService.execModule(executionInfo.moduleName, executionInfo.args, options);
            }
            else {
                const processService = yield this.serviceContainer.get(types_2.IProcessServiceFactory).create(resource);
                return processService.exec(executionInfo.execPath, executionInfo.args, Object.assign({}, options));
            }
        });
    }
};
PythonToolExecutionService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], PythonToolExecutionService);
exports.PythonToolExecutionService = PythonToolExecutionService;
//# sourceMappingURL=pythonToolService.js.map