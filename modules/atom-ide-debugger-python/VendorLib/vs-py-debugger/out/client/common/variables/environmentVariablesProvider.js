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
const vscode_1 = require("vscode");
const configSettings_1 = require("../configSettings");
const constants_1 = require("../platform/constants");
const types_1 = require("../types");
const types_2 = require("./types");
let EnvironmentVariablesProvider = class EnvironmentVariablesProvider {
    constructor(envVarsService, disposableRegistry, isWidows, process) {
        this.envVarsService = envVarsService;
        this.isWidows = isWidows;
        this.process = process;
        this.cache = new Map();
        this.fileWatchers = new Map();
        this.disposables = [];
        disposableRegistry.push(this);
        this.changeEventEmitter = new vscode_1.EventEmitter();
    }
    get onDidEnvironmentVariablesChange() {
        return this.changeEventEmitter.event;
    }
    dispose() {
        this.changeEventEmitter.dispose();
        this.fileWatchers.forEach(watcher => {
            watcher.dispose();
        });
    }
    getEnvironmentVariables(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = configSettings_1.PythonSettings.getInstance(resource);
            if (!this.cache.has(settings.envFile)) {
                const workspaceFolderUri = this.getWorkspaceFolderUri(resource);
                this.createFileWatcher(settings.envFile, workspaceFolderUri);
                let mergedVars = yield this.envVarsService.parseFile(settings.envFile);
                if (!mergedVars) {
                    mergedVars = {};
                }
                this.envVarsService.mergeVariables(this.process.env, mergedVars);
                const pathVariable = this.isWidows ? constants_1.WINDOWS_PATH_VARIABLE_NAME : constants_1.NON_WINDOWS_PATH_VARIABLE_NAME;
                this.envVarsService.appendPath(mergedVars, this.process.env[pathVariable]);
                this.envVarsService.appendPythonPath(mergedVars, this.process.env.PYTHONPATH);
                this.cache.set(settings.envFile, mergedVars);
            }
            return this.cache.get(settings.envFile);
        });
    }
    getWorkspaceFolderUri(resource) {
        if (!resource) {
            return;
        }
        const workspaceFolder = vscode_1.workspace.getWorkspaceFolder(resource);
        return workspaceFolder ? workspaceFolder.uri : undefined;
    }
    createFileWatcher(envFile, workspaceFolderUri) {
        if (this.fileWatchers.has(envFile)) {
            return;
        }
        const envFileWatcher = vscode_1.workspace.createFileSystemWatcher(envFile);
        this.fileWatchers.set(envFile, envFileWatcher);
        this.disposables.push(envFileWatcher.onDidChange(() => this.onEnvironmentFileChanged(envFile, workspaceFolderUri)));
        this.disposables.push(envFileWatcher.onDidCreate(() => this.onEnvironmentFileChanged(envFile, workspaceFolderUri)));
        this.disposables.push(envFileWatcher.onDidDelete(() => this.onEnvironmentFileChanged(envFile, workspaceFolderUri)));
    }
    onEnvironmentFileChanged(envFile, workspaceFolderUri) {
        this.cache.delete(envFile);
        this.changeEventEmitter.fire(workspaceFolderUri);
    }
};
EnvironmentVariablesProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IEnvironmentVariablesService)),
    __param(1, inversify_1.inject(types_1.IDisposableRegistry)), __param(2, inversify_1.inject(types_1.IsWindows)),
    __param(3, inversify_1.inject(types_1.ICurrentProcess))
], EnvironmentVariablesProvider);
exports.EnvironmentVariablesProvider = EnvironmentVariablesProvider;
//# sourceMappingURL=environmentVariablesProvider.js.map