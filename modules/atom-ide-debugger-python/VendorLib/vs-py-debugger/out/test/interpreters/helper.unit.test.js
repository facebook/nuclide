// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const helpers_1 = require("../../client/interpreter/helpers");
// tslint:disable-next-line:max-func-body-length
suite('Interpreters Display Helper', () => {
    let documentManager;
    let workspaceService;
    let serviceContainer;
    let helper;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        workspaceService = TypeMoq.Mock.ofType();
        documentManager = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IDocumentManager))).returns(() => documentManager.object);
        helper = new helpers_1.InterpreterHelper(serviceContainer.object);
    });
    test('getActiveWorkspaceUri should return undefined if there are no workspaces', () => {
        workspaceService.setup(w => w.workspaceFolders).returns(() => []);
        documentManager.setup(doc => doc.activeTextEditor).returns(() => undefined);
        const workspace = helper.getActiveWorkspaceUri();
        chai_1.expect(workspace).to.be.equal(undefined, 'incorrect value');
    });
    test('getActiveWorkspaceUri should return the workspace if there is only one', () => {
        const folderUri = vscode_1.Uri.file('abc');
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.workspaceFolders).returns(() => [{ uri: folderUri }]);
        const workspace = helper.getActiveWorkspaceUri();
        chai_1.expect(workspace).to.be.not.equal(undefined, 'incorrect value');
        chai_1.expect(workspace.folderUri).to.be.equal(folderUri);
        chai_1.expect(workspace.configTarget).to.be.equal(vscode_1.ConfigurationTarget.Workspace);
    });
    test('getActiveWorkspaceUri should return undefined if we no active editor and have more than one workspace folder', () => {
        const folderUri = vscode_1.Uri.file('abc');
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.workspaceFolders).returns(() => [{ uri: folderUri }, undefined]);
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
        const workspace = helper.getActiveWorkspaceUri();
        chai_1.expect(workspace).to.be.equal(undefined, 'incorrect value');
    });
    test('getActiveWorkspaceUri should return undefined of the active editor does not belong to a workspace and if we have more than one workspace folder', () => {
        const folderUri = vscode_1.Uri.file('abc');
        const documentUri = vscode_1.Uri.file('file');
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.workspaceFolders).returns(() => [{ uri: folderUri }, undefined]);
        const textEditor = TypeMoq.Mock.ofType();
        const document = TypeMoq.Mock.ofType();
        textEditor.setup(t => t.document).returns(() => document.object);
        document.setup(d => d.uri).returns(() => documentUri);
        documentManager.setup(d => d.activeTextEditor).returns(() => textEditor.object);
        workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(documentUri))).returns(() => undefined);
        const workspace = helper.getActiveWorkspaceUri();
        chai_1.expect(workspace).to.be.equal(undefined, 'incorrect value');
    });
    test('getActiveWorkspaceUri should return workspace folder of the active editor if belongs to a workspace and if we have more than one workspace folder', () => {
        const folderUri = vscode_1.Uri.file('abc');
        const documentWorkspaceFolderUri = vscode_1.Uri.file('file.abc');
        const documentUri = vscode_1.Uri.file('file');
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.workspaceFolders).returns(() => [{ uri: folderUri }, undefined]);
        const textEditor = TypeMoq.Mock.ofType();
        const document = TypeMoq.Mock.ofType();
        textEditor.setup(t => t.document).returns(() => document.object);
        document.setup(d => d.uri).returns(() => documentUri);
        documentManager.setup(d => d.activeTextEditor).returns(() => textEditor.object);
        // tslint:disable-next-line:no-any
        workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(documentUri))).returns(() => { return { uri: documentWorkspaceFolderUri }; });
        const workspace = helper.getActiveWorkspaceUri();
        chai_1.expect(workspace).to.be.not.equal(undefined, 'incorrect value');
        chai_1.expect(workspace.folderUri).to.be.equal(documentWorkspaceFolderUri);
        chai_1.expect(workspace.configTarget).to.be.equal(vscode_1.ConfigurationTarget.WorkspaceFolder);
    });
});
//# sourceMappingURL=helper.unit.test.js.map