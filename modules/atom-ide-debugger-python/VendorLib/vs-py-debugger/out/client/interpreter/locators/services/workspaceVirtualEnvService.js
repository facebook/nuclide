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
// tslint:disable:no-require-imports
const inversify_1 = require("inversify");
const path = require("path");
const untildify = require("untildify");
const types_1 = require("../../../common/application/types");
const types_2 = require("../../../common/types");
const types_3 = require("../../../ioc/types");
const contracts_1 = require("../../contracts");
const baseVirtualEnvService_1 = require("./baseVirtualEnvService");
let WorkspaceVirtualEnvService = class WorkspaceVirtualEnvService extends baseVirtualEnvService_1.BaseVirtualEnvService {
    constructor(workspaceVirtualEnvPathProvider, serviceContainer, builder) {
        super(workspaceVirtualEnvPathProvider, serviceContainer, 'WorkspaceVirtualEnvService', true);
        this.builder = builder;
    }
    getInterpreterWatchers(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            return [yield this.builder.getWorkspaceVirtualEnvInterpreterWatcher(resource)];
        });
    }
};
WorkspaceVirtualEnvService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(contracts_1.IVirtualEnvironmentsSearchPathProvider)), __param(0, inversify_1.named('workspace')),
    __param(1, inversify_1.inject(types_3.IServiceContainer)),
    __param(2, inversify_1.inject(contracts_1.IInterpreterWatcherBuilder))
], WorkspaceVirtualEnvService);
exports.WorkspaceVirtualEnvService = WorkspaceVirtualEnvService;
let WorkspaceVirtualEnvironmentsSearchPathProvider = class WorkspaceVirtualEnvironmentsSearchPathProvider {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    getSearchPaths(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const configService = this.serviceContainer.get(types_2.IConfigurationService);
            const paths = [];
            const venvPath = configService.getSettings(resource).venvPath;
            if (venvPath) {
                paths.push(untildify(venvPath));
            }
            const workspaceService = this.serviceContainer.get(types_1.IWorkspaceService);
            if (Array.isArray(workspaceService.workspaceFolders) && workspaceService.workspaceFolders.length > 0) {
                let wsPath;
                if (resource && workspaceService.workspaceFolders.length > 1) {
                    const wkspaceFolder = workspaceService.getWorkspaceFolder(resource);
                    if (wkspaceFolder) {
                        wsPath = wkspaceFolder.uri.fsPath;
                    }
                }
                else {
                    wsPath = workspaceService.workspaceFolders[0].uri.fsPath;
                }
                if (wsPath) {
                    paths.push(wsPath);
                    paths.push(path.join(wsPath, '.direnv'));
                }
            }
            return paths;
        });
    }
};
WorkspaceVirtualEnvironmentsSearchPathProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.IServiceContainer))
], WorkspaceVirtualEnvironmentsSearchPathProvider);
exports.WorkspaceVirtualEnvironmentsSearchPathProvider = WorkspaceVirtualEnvironmentsSearchPathProvider;
//# sourceMappingURL=workspaceVirtualEnvService.js.map