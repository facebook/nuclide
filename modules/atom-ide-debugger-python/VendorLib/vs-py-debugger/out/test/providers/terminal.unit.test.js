"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const constants_1 = require("../../client/common/constants");
const types_2 = require("../../client/common/terminal/types");
const terminalProvider_1 = require("../../client/providers/terminalProvider");
// tslint:disable-next-line:max-func-body-length
suite('Terminal Provider', () => {
    let serviceContainer;
    let commandManager;
    let workspace;
    let documentManager;
    let terminalProvider;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        commandManager = TypeMoq.Mock.ofType();
        workspace = TypeMoq.Mock.ofType();
        documentManager = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(types_1.ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup(c => c.get(types_1.IWorkspaceService)).returns(() => workspace.object);
        serviceContainer.setup(c => c.get(types_1.IDocumentManager)).returns(() => documentManager.object);
    });
    teardown(() => {
        try {
            terminalProvider.dispose();
            // tslint:disable-next-line:no-empty
        }
        catch (_a) { }
    });
    test('Ensure command is registered', () => {
        terminalProvider = new terminalProvider_1.TerminalProvider(serviceContainer.object);
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });
    test('Ensure command handler is disposed', () => {
        const disposable = TypeMoq.Mock.ofType();
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => disposable.object);
        terminalProvider = new terminalProvider_1.TerminalProvider(serviceContainer.object);
        terminalProvider.dispose();
        disposable.verify(d => d.dispose(), TypeMoq.Times.once());
    });
    test('Ensure terminal is created and displayed when command is invoked', () => {
        const disposable = TypeMoq.Mock.ofType();
        let commandHandler;
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
        workspace.setup(w => w.workspaceFolders).returns(() => undefined);
        terminalProvider = new terminalProvider_1.TerminalProvider(serviceContainer.object);
        chai_1.expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        const terminalServiceFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.ITerminalServiceFactory))).returns(() => terminalServiceFactory.object);
        const terminalService = TypeMoq.Mock.ofType();
        terminalServiceFactory.setup(t => t.createTerminalService(TypeMoq.It.isValue(undefined), TypeMoq.It.isValue('Python'))).returns(() => terminalService.object);
        commandHandler.call(terminalProvider);
        terminalService.verify(t => t.show(false), TypeMoq.Times.once());
    });
    test('Ensure terminal creation does not use uri of the active documents which is untitled', () => {
        const disposable = TypeMoq.Mock.ofType();
        let commandHandler;
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        const editor = TypeMoq.Mock.ofType();
        documentManager.setup(d => d.activeTextEditor).returns(() => editor.object);
        const document = TypeMoq.Mock.ofType();
        document.setup(d => d.isUntitled).returns(() => true);
        editor.setup(e => e.document).returns(() => document.object);
        workspace.setup(w => w.workspaceFolders).returns(() => undefined);
        terminalProvider = new terminalProvider_1.TerminalProvider(serviceContainer.object);
        chai_1.expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        const terminalServiceFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.ITerminalServiceFactory))).returns(() => terminalServiceFactory.object);
        const terminalService = TypeMoq.Mock.ofType();
        terminalServiceFactory.setup(t => t.createTerminalService(TypeMoq.It.isValue(undefined), TypeMoq.It.isValue('Python'))).returns(() => terminalService.object);
        commandHandler.call(terminalProvider);
        terminalService.verify(t => t.show(false), TypeMoq.Times.once());
    });
    test('Ensure terminal creation uses uri of active document', () => {
        const disposable = TypeMoq.Mock.ofType();
        let commandHandler;
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        const editor = TypeMoq.Mock.ofType();
        documentManager.setup(d => d.activeTextEditor).returns(() => editor.object);
        const document = TypeMoq.Mock.ofType();
        const documentUri = vscode_1.Uri.file('a');
        document.setup(d => d.isUntitled).returns(() => false);
        document.setup(d => d.uri).returns(() => documentUri);
        editor.setup(e => e.document).returns(() => document.object);
        workspace.setup(w => w.workspaceFolders).returns(() => undefined);
        terminalProvider = new terminalProvider_1.TerminalProvider(serviceContainer.object);
        chai_1.expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        const terminalServiceFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.ITerminalServiceFactory))).returns(() => terminalServiceFactory.object);
        const terminalService = TypeMoq.Mock.ofType();
        terminalServiceFactory.setup(t => t.createTerminalService(TypeMoq.It.isValue(documentUri), TypeMoq.It.isValue('Python'))).returns(() => terminalService.object);
        commandHandler.call(terminalProvider);
        terminalService.verify(t => t.show(false), TypeMoq.Times.once());
    });
    test('Ensure terminal creation uses uri of active workspace', () => {
        const disposable = TypeMoq.Mock.ofType();
        let commandHandler;
        commandManager.setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Create_Terminal), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((_cmd, callback) => {
            commandHandler = callback;
            return disposable.object;
        });
        documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
        const workspaceUri = vscode_1.Uri.file('a');
        const workspaceFolder = TypeMoq.Mock.ofType();
        workspaceFolder.setup(w => w.uri).returns(() => workspaceUri);
        workspace.setup(w => w.workspaceFolders).returns(() => [workspaceFolder.object]);
        terminalProvider = new terminalProvider_1.TerminalProvider(serviceContainer.object);
        chai_1.expect(commandHandler).not.to.be.equal(undefined, 'Handler not set');
        const terminalServiceFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.ITerminalServiceFactory))).returns(() => terminalServiceFactory.object);
        const terminalService = TypeMoq.Mock.ofType();
        terminalServiceFactory.setup(t => t.createTerminalService(TypeMoq.It.isValue(workspaceUri), TypeMoq.It.isValue('Python'))).returns(() => terminalService.object);
        commandHandler.call(terminalProvider);
        terminalService.verify(t => t.show(false), TypeMoq.Times.once());
    });
});
//# sourceMappingURL=terminal.unit.test.js.map