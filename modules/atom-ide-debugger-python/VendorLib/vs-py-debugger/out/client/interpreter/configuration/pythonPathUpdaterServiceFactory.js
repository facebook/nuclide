"use strict";
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
const types_1 = require("../../common/application/types");
const types_2 = require("../../ioc/types");
const globalUpdaterService_1 = require("./services/globalUpdaterService");
const workspaceFolderUpdaterService_1 = require("./services/workspaceFolderUpdaterService");
const workspaceUpdaterService_1 = require("./services/workspaceUpdaterService");
let PythonPathUpdaterServiceFactory = class PythonPathUpdaterServiceFactory {
    constructor(serviceContainer) {
        this.workspaceService = serviceContainer.get(types_1.IWorkspaceService);
    }
    getGlobalPythonPathConfigurationService() {
        return new globalUpdaterService_1.GlobalPythonPathUpdaterService(this.workspaceService);
    }
    getWorkspacePythonPathConfigurationService(wkspace) {
        return new workspaceUpdaterService_1.WorkspacePythonPathUpdaterService(wkspace, this.workspaceService);
    }
    getWorkspaceFolderPythonPathConfigurationService(workspaceFolder) {
        return new workspaceFolderUpdaterService_1.WorkspaceFolderPythonPathUpdaterService(workspaceFolder, this.workspaceService);
    }
};
PythonPathUpdaterServiceFactory = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], PythonPathUpdaterServiceFactory);
exports.PythonPathUpdaterServiceFactory = PythonPathUpdaterServiceFactory;
//# sourceMappingURL=pythonPathUpdaterServiceFactory.js.map