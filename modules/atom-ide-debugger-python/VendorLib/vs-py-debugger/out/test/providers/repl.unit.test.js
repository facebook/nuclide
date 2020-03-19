"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const constants_1 = require("../../client/common/constants");
const replProvider_1 = require("../../client/providers/replProvider");
const types_2 = require("../../client/terminals/types");
// tslint:disable-next-line:max-func-body-length
suite('REPL Provider', () => {
    let serviceContainer;
    let commandManager;
    let workspace;
    let codeExecutionService;
    let documentManager;
    let replProvider;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        commandManager = TypeMoq.Mock.ofType();
        workspace = TypeMoq.Mock.ofType();
        codeExecutionService = TypeMoq.Mock.ofType();
        documentManager = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(types_1.ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup(c => c.get(types_1.IWorkspaceService)).returns(() => workspace.object);
        serviceContainer.setup(c => c.get(types_2.ICodeExecutionService, TypeMoq.It.isValue('repl'))).returns(() => codeExecutionService.object);
        serviceContainer.setup(c => c.get(types_1.IDocumentManager)).returns(() => documentManager.object);
    });
    teardown(() => {
        try {
            replProvider.dispose();
            // tslint:disable-next-line:no-empty
        }
        catch (_a) { }
    });
    test('Ensure command is registered', () => {
        replProvider = new replProvider_1.ReplProvider(serviceContainer.object);
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });
    test('Ensure command handler is disposed', () => {
        const disposable = TypeMoq.Mock.ofType();
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => disposable.object);
        replProvider = new replProvider_1.ReplProvider(serviceContainer.object);
        replProvider.dispose();
        disposable.verify(d => d.dispose(), TypeMoq.Times.once());
    });
    test('Ensure resource is \'undefined\' if there\s no active document nor a workspace', () => {
        const disposable = TypeMoq.Mock.ofType();
        let commandHandler;
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
        replProvider = new replProvider_1.ReplProvider(serviceContainer.object);
        chai_1.expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler.call(replProvider);
        serviceContainer.verify(c => c.get(TypeMoq.It.isValue(types_2.ICodeExecutionService), TypeMoq.It.isValue('repl')), TypeMoq.Times.once());
        codeExecutionService.verify(c => c.initializeRepl(TypeMoq.It.isValue(undefined)), TypeMoq.Times.once());
    });
    test('Ensure resource is uri of the active document', () => {
        const disposable = TypeMoq.Mock.ofType();
        let commandHandler;
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        const documentUri = vscode_1.Uri.file('a');
        const editor = TypeMoq.Mock.ofType();
        const document = TypeMoq.Mock.ofType();
        document.setup(d => d.uri).returns(() => documentUri);
        document.setup(d => d.isUntitled).returns(() => false);
        editor.setup(e => e.document).returns(() => document.object);
        documentManager.setup(d => d.activeTextEditor).returns(() => editor.object);
        replProvider = new replProvider_1.ReplProvider(serviceContainer.object);
        chai_1.expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler.call(replProvider);
        serviceContainer.verify(c => c.get(TypeMoq.It.isValue(types_2.ICodeExecutionService), TypeMoq.It.isValue('repl')), TypeMoq.Times.once());
        codeExecutionService.verify(c => c.initializeRepl(TypeMoq.It.isValue(documentUri)), TypeMoq.Times.once());
    });
    test('Ensure resource is \'undefined\' if the active document is not used if it is untitled (new document)', () => {
        const disposable = TypeMoq.Mock.ofType();
        let commandHandler;
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        const editor = TypeMoq.Mock.ofType();
        const document = TypeMoq.Mock.ofType();
        document.setup(d => d.isUntitled).returns(() => true);
        editor.setup(e => e.document).returns(() => document.object);
        documentManager.setup(d => d.activeTextEditor).returns(() => editor.object);
        replProvider = new replProvider_1.ReplProvider(serviceContainer.object);
        chai_1.expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler.call(replProvider);
        serviceContainer.verify(c => c.get(TypeMoq.It.isValue(types_2.ICodeExecutionService), TypeMoq.It.isValue('repl')), TypeMoq.Times.once());
        codeExecutionService.verify(c => c.initializeRepl(TypeMoq.It.isValue(undefined)), TypeMoq.Times.once());
    });
    test('Ensure first available workspace folder is used if there no document', () => {
        const disposable = TypeMoq.Mock.ofType();
        let commandHandler;
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Start_REPL), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
        const workspaceUri = vscode_1.Uri.file('a');
        const workspaceFolder = TypeMoq.Mock.ofType();
        workspaceFolder.setup(w => w.uri).returns(() => workspaceUri);
        workspace.setup(w => w.workspaceFolders).returns(() => [workspaceFolder.object]);
        replProvider = new replProvider_1.ReplProvider(serviceContainer.object);
        chai_1.expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        commandHandler.call(replProvider);
        serviceContainer.verify(c => c.get(TypeMoq.It.isValue(types_2.ICodeExecutionService), TypeMoq.It.isValue('repl')), TypeMoq.Times.once());
        codeExecutionService.verify(c => c.initializeRepl(TypeMoq.It.isValue(workspaceUri)), TypeMoq.Times.once());
    });
});
//# sourceMappingURL=repl.unit.test.js.map