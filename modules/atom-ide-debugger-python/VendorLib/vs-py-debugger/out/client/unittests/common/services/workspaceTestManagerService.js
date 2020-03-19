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
const vscode_1 = require("vscode");
const types_1 = require("../../../common/types");
const constants_1 = require("./../constants");
const types_2 = require("./../types");
let WorkspaceTestManagerService = class WorkspaceTestManagerService {
    constructor(outChannel, testManagerServiceFactory, disposables) {
        this.outChannel = outChannel;
        this.testManagerServiceFactory = testManagerServiceFactory;
        this.workspaceTestManagers = new Map();
        disposables.push(this);
    }
    dispose() {
        this.workspaceTestManagers.forEach(info => info.dispose());
    }
    getTestManager(resource) {
        const wkspace = this.getWorkspace(resource);
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getTestManager();
    }
    getTestWorkingDirectory(resource) {
        const wkspace = this.getWorkspace(resource);
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getTestWorkingDirectory();
    }
    getPreferredTestManager(resource) {
        const wkspace = this.getWorkspace(resource);
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getPreferredTestManager();
    }
    getWorkspace(resource) {
        if (!Array.isArray(vscode_1.workspace.workspaceFolders) || vscode_1.workspace.workspaceFolders.length === 0) {
            const noWkspaceMessage = 'Please open a workspace';
            this.outChannel.appendLine(noWkspaceMessage);
            throw new Error(noWkspaceMessage);
        }
        if (!resource || vscode_1.workspace.workspaceFolders.length === 1) {
            return vscode_1.workspace.workspaceFolders[0].uri;
        }
        const workspaceFolder = vscode_1.workspace.getWorkspaceFolder(resource);
        if (workspaceFolder) {
            return workspaceFolder.uri;
        }
        const message = `Resource '${resource.fsPath}' does not belong to any workspace`;
        this.outChannel.appendLine(message);
        throw new Error(message);
    }
    ensureTestManagerService(wkspace) {
        if (!this.workspaceTestManagers.has(wkspace.fsPath)) {
            this.workspaceTestManagers.set(wkspace.fsPath, this.testManagerServiceFactory(wkspace));
        }
    }
};
WorkspaceTestManagerService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IOutputChannel)), __param(0, inversify_1.named(constants_1.TEST_OUTPUT_CHANNEL)),
    __param(1, inversify_1.inject(types_2.ITestManagerServiceFactory)),
    __param(2, inversify_1.inject(types_1.IDisposableRegistry))
], WorkspaceTestManagerService);
exports.WorkspaceTestManagerService = WorkspaceTestManagerService;
//# sourceMappingURL=workspaceTestManagerService.js.map