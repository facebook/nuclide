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
const vscode_1 = require("vscode");
const types_1 = require("../../../common/application/types");
const types_2 = require("../../../common/platform/types");
const types_3 = require("../../../common/process/types");
const types_4 = require("../../../common/types");
const types_5 = require("../../../ioc/types");
const contracts_1 = require("../../contracts");
const cacheableLocatorService_1 = require("./cacheableLocatorService");
const execName = 'pipenv';
const pipEnvFileNameVariable = 'PIPENV_PIPFILE';
let PipEnvService = class PipEnvService extends cacheableLocatorService_1.CacheableLocatorService {
    constructor(serviceContainer) {
        super('PipEnvService', serviceContainer);
        this.helper = this.serviceContainer.get(contracts_1.IInterpreterHelper);
        this.processServiceFactory = this.serviceContainer.get(types_3.IProcessServiceFactory);
        this.workspace = this.serviceContainer.get(types_1.IWorkspaceService);
        this.fs = this.serviceContainer.get(types_2.IFileSystem);
        this.logger = this.serviceContainer.get(types_4.ILogger);
    }
    // tslint:disable-next-line:no-empty
    dispose() { }
    isRelatedPipEnvironment(dir, pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            // In PipEnv, the name of the cwd is used as a prefix in the virtual env.
            if (pythonPath.indexOf(`${path.sep}${path.basename(dir)}-`) === -1) {
                return false;
            }
            const envName = yield this.getInterpreterPathFromPipenv(dir, true);
            return !!envName;
        });
    }
    getInterpretersImplementation(resource) {
        const pipenvCwd = this.getPipenvWorkingDirectory(resource);
        if (!pipenvCwd) {
            return Promise.resolve([]);
        }
        return this.getInterpreterFromPipenv(pipenvCwd)
            .then(item => item ? [item] : [])
            .catch(() => []);
    }
    getInterpreterFromPipenv(pipenvCwd) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpreterPath = yield this.getInterpreterPathFromPipenv(pipenvCwd);
            if (!interpreterPath) {
                return;
            }
            const details = yield this.helper.getInterpreterInformation(interpreterPath);
            if (!details) {
                return;
            }
            return Object.assign({}, details, { path: interpreterPath, type: contracts_1.InterpreterType.PipEnv });
        });
    }
    getPipenvWorkingDirectory(resource) {
        // The file is not in a workspace. However, workspace may be opened
        // and file is just a random file opened from elsewhere. In this case
        // we still want to provide interpreter associated with the workspace.
        // Otherwise if user tries and formats the file, we may end up using
        // plain pip module installer to bring in the formatter and it is wrong.
        const wsFolder = resource ? this.workspace.getWorkspaceFolder(resource) : undefined;
        return wsFolder ? wsFolder.uri.fsPath : this.workspace.rootPath;
    }
    getInterpreterPathFromPipenv(cwd, ignoreErrors = false) {
        return __awaiter(this, void 0, void 0, function* () {
            // Quick check before actually running pipenv
            if (!(yield this.checkIfPipFileExists(cwd))) {
                return;
            }
            try {
                const pythonPath = yield this.invokePipenv('--py', cwd);
                // TODO: Why do we need to do this?
                return pythonPath && (yield this.fs.fileExists(pythonPath)) ? pythonPath : undefined;
                // tslint:disable-next-line:no-empty
            }
            catch (error) {
                console.error(error);
                if (ignoreErrors) {
                    return;
                }
                const errorMessage = error.message || error;
                const appShell = this.serviceContainer.get(types_1.IApplicationShell);
                appShell.showWarningMessage(`Workspace contains pipfile but attempt to run 'pipenv --py' failed with ${errorMessage}. Make sure pipenv is on the PATH.`);
            }
        });
    }
    checkIfPipFileExists(cwd) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentProcess = this.serviceContainer.get(types_4.ICurrentProcess);
            const pipFileName = currentProcess.env[pipEnvFileNameVariable];
            if (typeof pipFileName === 'string' && (yield this.fs.fileExists(path.join(cwd, pipFileName)))) {
                return true;
            }
            if (yield this.fs.fileExists(path.join(cwd, 'Pipfile'))) {
                return true;
            }
            return false;
        });
    }
    invokePipenv(arg, rootPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const processService = yield this.processServiceFactory.create(vscode_1.Uri.file(rootPath));
                const result = yield processService.exec(execName, [arg], { cwd: rootPath });
                if (result) {
                    const stdout = result.stdout ? result.stdout.trim() : '';
                    const stderr = result.stderr ? result.stderr.trim() : '';
                    if (stderr.length > 0 && stdout.length === 0) {
                        throw new Error(stderr);
                    }
                    return stdout;
                }
                // tslint:disable-next-line:no-empty
            }
            catch (error) {
                const platformService = this.serviceContainer.get(types_2.IPlatformService);
                const currentProc = this.serviceContainer.get(types_4.ICurrentProcess);
                const enviromentVariableValues = {
                    LC_ALL: currentProc.env.LC_ALL,
                    LANG: currentProc.env.LANG
                };
                enviromentVariableValues[platformService.pathVariableName] = currentProc.env[platformService.pathVariableName];
                this.logger.logWarning('Error in invoking PipEnv', error);
                this.logger.logWarning(`Relevant Environment Variables ${JSON.stringify(enviromentVariableValues, undefined, 4)}`);
                const errorMessage = error.message || error;
                const appShell = this.serviceContainer.get(types_1.IApplicationShell);
                appShell.showWarningMessage(`Workspace contains pipfile but attempt to run 'pipenv --venv' failed with '${errorMessage}'. Make sure pipenv is on the PATH.`);
            }
        });
    }
};
PipEnvService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_5.IServiceContainer))
], PipEnvService);
exports.PipEnvService = PipEnvService;
//# sourceMappingURL=pipEnvService.js.map