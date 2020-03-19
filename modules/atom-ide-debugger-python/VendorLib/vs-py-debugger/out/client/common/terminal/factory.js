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
const types_1 = require("../../ioc/types");
const types_2 = require("../application/types");
const service_1 = require("./service");
let TerminalServiceFactory = class TerminalServiceFactory {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.terminalServices = new Map();
    }
    getTerminalService(resource, title) {
        const terminalTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Python';
        const id = this.getTerminalId(terminalTitle, resource);
        if (!this.terminalServices.has(id)) {
            const terminalService = new service_1.TerminalService(this.serviceContainer, resource, terminalTitle);
            this.terminalServices.set(id, terminalService);
        }
        return this.terminalServices.get(id);
    }
    createTerminalService(resource, title) {
        const terminalTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Python';
        return new service_1.TerminalService(this.serviceContainer, resource, terminalTitle);
    }
    getTerminalId(title, resource) {
        if (!resource) {
            return title;
        }
        const workspaceFolder = this.serviceContainer.get(types_2.IWorkspaceService).getWorkspaceFolder(resource);
        return workspaceFolder ? `${title}:${workspaceFolder.uri.fsPath}` : title;
    }
};
TerminalServiceFactory = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], TerminalServiceFactory);
exports.TerminalServiceFactory = TerminalServiceFactory;
//# sourceMappingURL=factory.js.map