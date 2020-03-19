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
const types_1 = require("../../../common/application/types");
const logger_1 = require("../../../common/logger");
const async_1 = require("../../../common/utils/async");
const types_2 = require("../../../ioc/types");
const contracts_1 = require("../../contracts");
let InterpreterWatcherBuilder = class InterpreterWatcherBuilder {
    /**
     * Creates an instance of InterpreterWatcherBuilder.
     * Inject the DI container, as we need to get a new instance of IInterpreterWatcher to build it.
     * @param {IWorkspaceService} workspaceService
     * @param {IServiceContainer} serviceContainer
     * @memberof InterpreterWatcherBuilder
     */
    constructor(workspaceService, serviceContainer) {
        this.workspaceService = workspaceService;
        this.serviceContainer = serviceContainer;
        this.watchersByResource = new Map();
    }
    getWorkspaceVirtualEnvInterpreterWatcher(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.getResourceKey(resource);
            if (!this.watchersByResource.has(key)) {
                const deferred = async_1.createDeferred();
                this.watchersByResource.set(key, deferred.promise);
                const watcher = this.serviceContainer.get(contracts_1.IInterpreterWatcher, contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE);
                yield watcher.register(resource);
                deferred.resolve(watcher);
            }
            return this.watchersByResource.get(key);
        });
    }
    getResourceKey(resource) {
        const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        return workspaceFolder ? workspaceFolder.uri.fsPath : '';
    }
};
__decorate([
    logger_1.traceVerbose('Build the workspace interpreter watcher')
], InterpreterWatcherBuilder.prototype, "getWorkspaceVirtualEnvInterpreterWatcher", null);
InterpreterWatcherBuilder = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IWorkspaceService)),
    __param(1, inversify_1.inject(types_2.IServiceContainer))
], InterpreterWatcherBuilder);
exports.InterpreterWatcherBuilder = InterpreterWatcherBuilder;
//# sourceMappingURL=interpreterWatcherBuilder.js.map