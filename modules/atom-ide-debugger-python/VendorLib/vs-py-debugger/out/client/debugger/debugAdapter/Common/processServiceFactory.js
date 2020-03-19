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
const proc_1 = require("../../../common/process/proc");
const types_1 = require("../../../common/process/types");
const types_2 = require("../../../ioc/types");
let DebuggerProcessServiceFactory = class DebuggerProcessServiceFactory {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    create() {
        const processService = new proc_1.ProcessService(this.serviceContainer.get(types_1.IBufferDecoder), process.env);
        return Promise.resolve(processService);
    }
};
DebuggerProcessServiceFactory = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], DebuggerProcessServiceFactory);
exports.DebuggerProcessServiceFactory = DebuggerProcessServiceFactory;
//# sourceMappingURL=processServiceFactory.js.map