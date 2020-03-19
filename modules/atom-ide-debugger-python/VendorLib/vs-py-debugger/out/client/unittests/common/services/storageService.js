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
let TestCollectionStorageService = class TestCollectionStorageService {
    constructor(disposables) {
        this.testsIndexedByWorkspaceUri = new Map();
        disposables.push(this);
    }
    getTests(wkspace) {
        const workspaceFolder = this.getWorkspaceFolderPath(wkspace) || '';
        return this.testsIndexedByWorkspaceUri.has(workspaceFolder) ? this.testsIndexedByWorkspaceUri.get(workspaceFolder) : undefined;
    }
    storeTests(wkspace, tests) {
        const workspaceFolder = this.getWorkspaceFolderPath(wkspace) || '';
        this.testsIndexedByWorkspaceUri.set(workspaceFolder, tests);
    }
    dispose() {
        this.testsIndexedByWorkspaceUri.clear();
    }
    getWorkspaceFolderPath(resource) {
        const folder = vscode_1.workspace.getWorkspaceFolder(resource);
        return folder ? folder.uri.path : undefined;
    }
};
TestCollectionStorageService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IDisposableRegistry))
], TestCollectionStorageService);
exports.TestCollectionStorageService = TestCollectionStorageService;
//# sourceMappingURL=storageService.js.map