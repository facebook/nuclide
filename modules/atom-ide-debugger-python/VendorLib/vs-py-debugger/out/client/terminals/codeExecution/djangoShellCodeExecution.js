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
const path = require("path");
const types_1 = require("../../common/application/types");
require("../../common/extensions");
const types_2 = require("../../common/platform/types");
const types_3 = require("../../common/terminal/types");
const types_4 = require("../../common/types");
const djangoContext_1 = require("./djangoContext");
const terminalCodeExecution_1 = require("./terminalCodeExecution");
let DjangoShellCodeExecutionProvider = class DjangoShellCodeExecutionProvider extends terminalCodeExecution_1.TerminalCodeExecutionProvider {
    constructor(terminalServiceFactory, configurationService, workspace, documentManager, platformService, commandManager, fileSystem, disposableRegistry) {
        super(terminalServiceFactory, configurationService, workspace, disposableRegistry, platformService);
        this.terminalTitle = 'Django Shell';
        disposableRegistry.push(new djangoContext_1.DjangoContextInitializer(documentManager, workspace, fileSystem, commandManager));
    }
    getReplCommandArgs(resource) {
        const pythonSettings = this.configurationService.getSettings(resource);
        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const args = pythonSettings.terminal.launchArgs.slice();
        const workspaceUri = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        const defaultWorkspace = Array.isArray(this.workspace.workspaceFolders) && this.workspace.workspaceFolders.length > 0 ? this.workspace.workspaceFolders[0].uri.fsPath : '';
        const workspaceRoot = workspaceUri ? workspaceUri.uri.fsPath : defaultWorkspace;
        const managePyPath = workspaceRoot.length === 0 ? 'manage.py' : path.join(workspaceRoot, 'manage.py');
        args.push(managePyPath.fileToCommandArgument());
        args.push('shell');
        return { command, args };
    }
};
DjangoShellCodeExecutionProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.ITerminalServiceFactory)),
    __param(1, inversify_1.inject(types_4.IConfigurationService)),
    __param(2, inversify_1.inject(types_1.IWorkspaceService)),
    __param(3, inversify_1.inject(types_1.IDocumentManager)),
    __param(4, inversify_1.inject(types_2.IPlatformService)),
    __param(5, inversify_1.inject(types_1.ICommandManager)),
    __param(6, inversify_1.inject(types_2.IFileSystem)),
    __param(7, inversify_1.inject(types_4.IDisposableRegistry))
], DjangoShellCodeExecutionProvider);
exports.DjangoShellCodeExecutionProvider = DjangoShellCodeExecutionProvider;
//# sourceMappingURL=djangoShellCodeExecution.js.map