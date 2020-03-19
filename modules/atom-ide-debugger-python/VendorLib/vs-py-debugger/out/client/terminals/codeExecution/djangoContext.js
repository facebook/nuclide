"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
const contextKey_1 = require("../../common/contextKey");
let DjangoContextInitializer = class DjangoContextInitializer {
    constructor(documentManager, workpaceService, fileSystem, commandManager) {
        this.documentManager = documentManager;
        this.workpaceService = workpaceService;
        this.fileSystem = fileSystem;
        this.workspaceContextKeyValues = new Map();
        this.disposables = [];
        this.isDjangoProject = new contextKey_1.ContextKey('python.isDjangoProject', commandManager);
        this.ensureContextStateIsSet()
            .catch(ex => console.error('Python Extension: ensureState', ex));
        this.disposables.push(this.workpaceService.onDidChangeWorkspaceFolders(() => this.updateContextKeyBasedOnActiveWorkspace()));
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    updateContextKeyBasedOnActiveWorkspace() {
        if (this.monitoringActiveTextEditor) {
            return;
        }
        this.monitoringActiveTextEditor = true;
        this.disposables.push(this.documentManager.onDidChangeActiveTextEditor(() => this.ensureContextStateIsSet()));
    }
    getActiveWorkspace() {
        if (!Array.isArray(this.workpaceService.workspaceFolders) || this.workpaceService.workspaceFolders.length === 0) {
            return;
        }
        if (this.workpaceService.workspaceFolders.length === 1) {
            return this.workpaceService.workspaceFolders[0].uri.fsPath;
        }
        const activeEditor = this.documentManager.activeTextEditor;
        if (!activeEditor) {
            return;
        }
        const workspaceFolder = this.workpaceService.getWorkspaceFolder(activeEditor.document.uri);
        return workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
    }
    ensureContextStateIsSet() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeWorkspace = this.getActiveWorkspace();
            if (!activeWorkspace) {
                return this.isDjangoProject.set(false);
            }
            if (this.lastCheckedWorkspace === activeWorkspace) {
                return;
            }
            if (this.workspaceContextKeyValues.has(activeWorkspace)) {
                yield this.isDjangoProject.set(this.workspaceContextKeyValues.get(activeWorkspace));
            }
            else {
                const exists = yield this.fileSystem.fileExists(path.join(activeWorkspace, 'manage.py'));
                yield this.isDjangoProject.set(exists);
                this.workspaceContextKeyValues.set(activeWorkspace, exists);
                this.lastCheckedWorkspace = activeWorkspace;
            }
        });
    }
};
DjangoContextInitializer = __decorate([
    inversify_1.injectable()
], DjangoContextInitializer);
exports.DjangoContextInitializer = DjangoContextInitializer;
//# sourceMappingURL=djangoContext.js.map