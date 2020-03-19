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
const path = require("path");
const types_1 = require("../../common/application/types");
const types_2 = require("../../common/platform/types");
const types_3 = require("../../common/process/types");
const types_4 = require("../../common/terminal/types");
const types_5 = require("../../common/types");
const enum_1 = require("../../common/utils/enum");
const misc_1 = require("../../common/utils/misc");
const types_6 = require("../../ioc/types");
const contracts_1 = require("../contracts");
const PYENVFILES = ['pyvenv.cfg', path.join('..', 'pyvenv.cfg')];
let VirtualEnvironmentManager = class VirtualEnvironmentManager {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.processServiceFactory = serviceContainer.get(types_3.IProcessServiceFactory);
        this.fs = serviceContainer.get(types_2.IFileSystem);
        this.pipEnvService = serviceContainer.get(contracts_1.IPipEnvService);
        this.workspaceService = serviceContainer.get(types_1.IWorkspaceService);
    }
    getEnvironmentName(pythonPath, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultWorkspaceUri = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders[0].uri : undefined;
            const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
            const workspaceUri = workspaceFolder ? workspaceFolder.uri : defaultWorkspaceUri;
            const grandParentDirName = path.basename(path.dirname(path.dirname(pythonPath)));
            if (workspaceUri && (yield this.pipEnvService.isRelatedPipEnvironment(workspaceUri.fsPath, pythonPath))) {
                // In pipenv, return the folder name of the workspace.
                return path.basename(workspaceUri.fsPath);
            }
            return grandParentDirName;
        });
    }
    getEnvironmentType(pythonPath, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isVenvEnvironment(pythonPath)) {
                return contracts_1.InterpreterType.Venv;
            }
            if (yield this.isPyEnvEnvironment(pythonPath, resource)) {
                return contracts_1.InterpreterType.Pyenv;
            }
            if (yield this.isPipEnvironment(pythonPath, resource)) {
                return contracts_1.InterpreterType.PipEnv;
            }
            if (yield this.isVirtualEnvironment(pythonPath)) {
                return contracts_1.InterpreterType.VirtualEnv;
            }
            // Lets not try to determine whether this is a conda environment or not.
            return contracts_1.InterpreterType.Unknown;
        });
    }
    isVenvEnvironment(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const dir = path.dirname(pythonPath);
            const pyEnvCfgFiles = PYENVFILES.map(file => path.join(dir, file));
            for (const file of pyEnvCfgFiles) {
                if (yield this.fs.fileExists(file)) {
                    return true;
                }
            }
            return false;
        });
    }
    isPyEnvEnvironment(pythonPath, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const pyEnvRoot = yield this.getPyEnvRoot(resource);
            return pyEnvRoot && pythonPath.startsWith(pyEnvRoot);
        });
    }
    isPipEnvironment(pythonPath, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultWorkspaceUri = this.workspaceService.hasWorkspaceFolders ? this.workspaceService.workspaceFolders[0].uri : undefined;
            const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
            const workspaceUri = workspaceFolder ? workspaceFolder.uri : defaultWorkspaceUri;
            if (workspaceUri && (yield this.pipEnvService.isRelatedPipEnvironment(workspaceUri.fsPath, pythonPath))) {
                return true;
            }
            return false;
        });
    }
    getPyEnvRoot(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.pyEnvRoot) {
                return this.pyEnvRoot;
            }
            const currentProccess = this.serviceContainer.get(types_5.ICurrentProcess);
            const pyenvRoot = currentProccess.env.PYENV_ROOT;
            if (pyenvRoot) {
                return this.pyEnvRoot = pyenvRoot;
            }
            try {
                const processService = yield this.processServiceFactory.create(resource);
                const output = yield processService.exec('pyenv', ['root']);
                if (output.stdout.trim().length > 0) {
                    return this.pyEnvRoot = output.stdout.trim();
                }
            }
            catch (_a) {
                misc_1.noop();
            }
            const pathUtils = this.serviceContainer.get(types_5.IPathUtils);
            return this.pyEnvRoot = path.join(pathUtils.home, '.pyenv');
        });
    }
    isVirtualEnvironment(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = this.getTerminalActivationProviderForVirtualEnvs();
            const shells = enum_1.getNamesAndValues(types_4.TerminalShellType)
                .filter(shell => provider.isShellSupported(shell.value))
                .map(shell => shell.value);
            for (const shell of shells) {
                const cmds = yield provider.getActivationCommandsForInterpreter(pythonPath, shell);
                if (cmds && cmds.length > 0) {
                    return true;
                }
            }
            return false;
        });
    }
    getTerminalActivationProviderForVirtualEnvs() {
        const isWindows = this.serviceContainer.get(types_2.IPlatformService).isWindows;
        const serviceName = isWindows ? 'commandPromptAndPowerShell' : 'bashCShellFish';
        return this.serviceContainer.get(types_4.ITerminalActivationCommandProvider, serviceName);
    }
};
VirtualEnvironmentManager = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_6.IServiceContainer))
], VirtualEnvironmentManager);
exports.VirtualEnvironmentManager = VirtualEnvironmentManager;
//# sourceMappingURL=index.js.map