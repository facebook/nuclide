"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any
const chai_1 = require("chai");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/process/types");
const contracts_1 = require("../../client/interpreter/contracts");
const virtualEnvs_1 = require("../../client/interpreter/virtualEnvs");
suite('Virtual environment manager', () => {
    const virtualEnvFolderName = 'virtual Env Folder Name';
    const pythonPath = path.join('a', 'b', virtualEnvFolderName, 'd', 'python');
    test('Plain Python environment suffix', () => __awaiter(this, void 0, void 0, function* () { return testSuffix(virtualEnvFolderName); }));
    test('Plain Python environment suffix with workspace Uri', () => __awaiter(this, void 0, void 0, function* () { return testSuffix(virtualEnvFolderName, false, vscode_1.Uri.file(path.join('1', '2', '3', '4'))); }));
    test('Plain Python environment suffix with PipEnv', () => __awaiter(this, void 0, void 0, function* () { return testSuffix('workspaceName', true, vscode_1.Uri.file(path.join('1', '2', '3', 'workspaceName'))); }));
    test('Use environment folder as env name', () => __awaiter(this, void 0, void 0, function* () {
        const serviceContainer = TypeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(contracts_1.IPipEnvService))).returns(() => TypeMoq.Mock.ofType().object);
        const workspaceService = TypeMoq.Mock.ofType();
        workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
        const venvManager = new virtualEnvs_1.VirtualEnvironmentManager(serviceContainer.object);
        const name = yield venvManager.getEnvironmentName(pythonPath);
        chai_1.expect(name).to.be.equal(virtualEnvFolderName);
    }));
    test('Use workspacec name as env name', () => __awaiter(this, void 0, void 0, function* () {
        const serviceContainer = TypeMoq.Mock.ofType();
        const pipEnvService = TypeMoq.Mock.ofType();
        pipEnvService
            .setup(p => p.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_3.IProcessServiceFactory))).returns(() => TypeMoq.Mock.ofType().object);
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(contracts_1.IPipEnvService))).returns(() => pipEnvService.object);
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_2.IFileSystem))).returns(() => TypeMoq.Mock.ofType().object);
        const workspaceUri = vscode_1.Uri.file(path.join('root', 'sub', 'wkspace folder'));
        const workspaceFolder = { name: 'wkspace folder', index: 0, uri: workspaceUri };
        const workspaceService = TypeMoq.Mock.ofType();
        workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => true);
        workspaceService.setup(w => w.workspaceFolders).returns(() => [workspaceFolder]);
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
        const venvManager = new virtualEnvs_1.VirtualEnvironmentManager(serviceContainer.object);
        const name = yield venvManager.getEnvironmentName(pythonPath);
        chai_1.expect(name).to.be.equal(path.basename(workspaceUri.fsPath));
        pipEnvService.verifyAll();
    }));
    function testSuffix(expectedEnvName, isPipEnvironment = false, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const serviceContainer = TypeMoq.Mock.ofType();
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_3.IProcessServiceFactory))).returns(() => TypeMoq.Mock.ofType().object);
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_2.IFileSystem))).returns(() => TypeMoq.Mock.ofType().object);
            const pipEnvService = TypeMoq.Mock.ofType();
            pipEnvService.setup(w => w.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(isPipEnvironment));
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(contracts_1.IPipEnvService))).returns(() => pipEnvService.object);
            const workspaceService = TypeMoq.Mock.ofType();
            workspaceService.setup(w => w.hasWorkspaceFolders).returns(() => false);
            if (resource) {
                const workspaceFolder = TypeMoq.Mock.ofType();
                workspaceFolder.setup(w => w.uri).returns(() => resource);
                workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
            }
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
            const venvManager = new virtualEnvs_1.VirtualEnvironmentManager(serviceContainer.object);
            const name = yield venvManager.getEnvironmentName(pythonPath, resource);
            chai_1.expect(name).to.be.equal(expectedEnvName, 'Virtual envrironment name suffix is incorrect.');
        });
    }
});
//# sourceMappingURL=virtualEnvManager.unit.test.js.map