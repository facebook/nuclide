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
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../../common/application/types");
require("../../../common/extensions");
const logger_1 = require("../../../common/logger");
const types_2 = require("../../../common/platform/types");
const types_3 = require("../../../common/process/types");
const types_4 = require("../../../common/types");
const maxTimeToWaitForEnvCreation = 60000;
const timeToPollForEnvCreation = 2000;
let WorkspaceVirtualEnvWatcherService = class WorkspaceVirtualEnvWatcherService {
    constructor(disposableRegistry, workspaceService, platformService, pythonExecFactory) {
        this.disposableRegistry = disposableRegistry;
        this.workspaceService = workspaceService;
        this.platformService = platformService;
        this.pythonExecFactory = pythonExecFactory;
        this.timers = new Map();
        this.fsWatchers = [];
        this.didCreate = new vscode_1.EventEmitter();
        disposableRegistry.push(this);
    }
    get onDidCreate() {
        return this.didCreate.event;
    }
    dispose() {
        this.clearTimers();
    }
    register(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.fsWatchers.length > 0) {
                return;
            }
            const workspaceFolder = resource ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
            const executable = this.platformService.isWindows ? 'python.exe' : 'python';
            const patterns = [path.join('*', executable), path.join('*', '*', executable)];
            for (const pattern of patterns) {
                const globPatern = workspaceFolder ? new vscode_1.RelativePattern(workspaceFolder.uri.fsPath, pattern) : pattern;
                logger_1.Logger.verbose(`Create file systemwatcher with pattern ${pattern}`);
                const fsWatcher = this.workspaceService.createFileSystemWatcher(globPatern);
                fsWatcher.onDidCreate(e => this.createHandler(e), this, this.disposableRegistry);
                this.disposableRegistry.push(fsWatcher);
                this.fsWatchers.push(fsWatcher);
            }
        });
    }
    createHandler(e) {
        return __awaiter(this, void 0, void 0, function* () {
            this.didCreate.fire();
            // On Windows, creation of environments are very slow, hence lets notify again after
            // the python executable is accessible (i.e. when we can launch the process).
            this.notifyCreationWhenReady(e.fsPath).ignoreErrors();
        });
    }
    notifyCreationWhenReady(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const counter = this.timers.has(pythonPath) ? this.timers.get(pythonPath).counter + 1 : 0;
            const isValid = yield this.isValidExecutable(pythonPath);
            if (isValid) {
                if (counter > 0) {
                    this.didCreate.fire();
                }
                return this.timers.delete(pythonPath);
            }
            if (counter > (maxTimeToWaitForEnvCreation / timeToPollForEnvCreation)) {
                // Send notification before we give up trying.
                this.didCreate.fire();
                this.timers.delete(pythonPath);
                return;
            }
            const timer = setTimeout(() => this.notifyCreationWhenReady(pythonPath).ignoreErrors(), timeToPollForEnvCreation);
            this.timers.set(pythonPath, { timer, counter });
        });
    }
    clearTimers() {
        this.timers.forEach(item => clearTimeout(item.timer));
        this.timers.clear();
    }
    isValidExecutable(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const execService = yield this.pythonExecFactory.create({ pythonPath });
            const info = yield execService.getInterpreterInformation().catch(() => undefined);
            return info !== undefined;
        });
    }
};
__decorate([
    logger_1.traceVerbose('Register Intepreter Watcher')
], WorkspaceVirtualEnvWatcherService.prototype, "register", null);
__decorate([
    logger_1.traceVerbose('Intepreter Watcher change handler')
], WorkspaceVirtualEnvWatcherService.prototype, "createHandler", null);
WorkspaceVirtualEnvWatcherService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_4.IDisposableRegistry)),
    __param(1, inversify_1.inject(types_1.IWorkspaceService)),
    __param(2, inversify_1.inject(types_2.IPlatformService)),
    __param(3, inversify_1.inject(types_3.IPythonExecutionFactory))
], WorkspaceVirtualEnvWatcherService);
exports.WorkspaceVirtualEnvWatcherService = WorkspaceVirtualEnvWatcherService;
//# sourceMappingURL=workspaceVirtualEnvWatcherService.js.map