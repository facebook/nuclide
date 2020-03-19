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
// tslint:disable:no-multiline-string no-trailing-whitespace
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const constants_1 = require("../../../client/common/constants");
const codeExecutionManager_1 = require("../../../client/terminals/codeExecution/codeExecutionManager");
const types_1 = require("../../../client/terminals/types");
// tslint:disable-next-line:max-func-body-length
suite('Terminal - Code Execution Manager', () => {
    let executionManager;
    let workspace;
    let commandManager;
    let disposables = [];
    let serviceContainer;
    let documentManager;
    setup(() => {
        workspace = TypeMoq.Mock.ofType();
        workspace.setup(c => c.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
            return {
                dispose: () => void 0
            };
        });
        documentManager = TypeMoq.Mock.ofType();
        commandManager = TypeMoq.Mock.ofType();
        serviceContainer = TypeMoq.Mock.ofType();
        executionManager = new codeExecutionManager_1.CodeExecutionManager(commandManager.object, documentManager.object, disposables, serviceContainer.object);
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
        disposables = [];
    });
    test('Ensure commands are registered', () => __awaiter(this, void 0, void 0, function* () {
        executionManager.registerCommands();
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Exec_In_Terminal), TypeMoq.It.isAny()), TypeMoq.Times.once());
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Exec_Selection_In_Terminal), TypeMoq.It.isAny()), TypeMoq.Times.once());
        commandManager.verify(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Exec_Selection_In_Django_Shell), TypeMoq.It.isAny()), TypeMoq.Times.once());
    }));
    test('Ensure executeFileInterTerminal will do nothing if no file is avialble', () => __awaiter(this, void 0, void 0, function* () {
        let commandHandler;
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command, callback, _thisArg) => {
                if (command === constants_1.Commands.Exec_In_Terminal) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();
        chai_1.expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');
        const helper = TypeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionHelper))).returns(() => helper.object);
        yield commandHandler();
        helper.verify((h) => __awaiter(this, void 0, void 0, function* () { return h.getFileToExecute(); }), TypeMoq.Times.once());
    }));
    test('Ensure executeFileInterTerminal will use provided file', () => __awaiter(this, void 0, void 0, function* () {
        let commandHandler;
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command, callback, _thisArg) => {
                if (command === constants_1.Commands.Exec_In_Terminal) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();
        chai_1.expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');
        const helper = TypeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionHelper))).returns(() => helper.object);
        const executionService = TypeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionService), TypeMoq.It.isValue('standard'))).returns(() => executionService.object);
        const fileToExecute = vscode_1.Uri.file('x');
        yield commandHandler(fileToExecute);
        helper.verify((h) => __awaiter(this, void 0, void 0, function* () { return h.getFileToExecute(); }), TypeMoq.Times.never());
        executionService.verify((e) => __awaiter(this, void 0, void 0, function* () { return e.executeFile(TypeMoq.It.isValue(fileToExecute)); }), TypeMoq.Times.once());
    }));
    test('Ensure executeFileInterTerminal will use active file', () => __awaiter(this, void 0, void 0, function* () {
        let commandHandler;
        // tslint:disable-next-line:no-any
        commandManager.setup(c => c.registerCommand).returns(() => {
            // tslint:disable-next-line:no-any
            return (command, callback, _thisArg) => {
                if (command === constants_1.Commands.Exec_In_Terminal) {
                    commandHandler = callback;
                }
                return { dispose: () => void 0 };
            };
        });
        executionManager.registerCommands();
        chai_1.expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');
        const fileToExecute = vscode_1.Uri.file('x');
        const helper = TypeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionHelper))).returns(() => helper.object);
        helper.setup((h) => __awaiter(this, void 0, void 0, function* () { return h.getFileToExecute(); })).returns(() => Promise.resolve(fileToExecute));
        const executionService = TypeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionService), TypeMoq.It.isValue('standard'))).returns(() => executionService.object);
        yield commandHandler(fileToExecute);
        executionService.verify((e) => __awaiter(this, void 0, void 0, function* () { return e.executeFile(TypeMoq.It.isValue(fileToExecute)); }), TypeMoq.Times.once());
    }));
    function testExecutionOfSelectionWithoutAnyActiveDocument(commandId, executionSericeId) {
        return __awaiter(this, void 0, void 0, function* () {
            let commandHandler;
            // tslint:disable-next-line:no-any
            commandManager.setup(c => c.registerCommand).returns(() => {
                // tslint:disable-next-line:no-any
                return (command, callback, _thisArg) => {
                    if (command === commandId) {
                        commandHandler = callback;
                    }
                    return { dispose: () => void 0 };
                };
            });
            executionManager.registerCommands();
            chai_1.expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');
            const helper = TypeMoq.Mock.ofType();
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionHelper))).returns(() => helper.object);
            const executionService = TypeMoq.Mock.ofType();
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionService), TypeMoq.It.isValue(executionSericeId))).returns(() => executionService.object);
            documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
            yield commandHandler();
            executionService.verify((e) => __awaiter(this, void 0, void 0, function* () { return e.execute(TypeMoq.It.isAny()); }), TypeMoq.Times.never());
        });
    }
    test('Ensure executeSelectionInTerminal will do nothing if theres no active document', () => __awaiter(this, void 0, void 0, function* () {
        yield testExecutionOfSelectionWithoutAnyActiveDocument(constants_1.Commands.Exec_Selection_In_Terminal, 'standard');
    }));
    test('Ensure executeSelectionInDjangoShell will do nothing if theres no active document', () => __awaiter(this, void 0, void 0, function* () {
        yield testExecutionOfSelectionWithoutAnyActiveDocument(constants_1.Commands.Exec_Selection_In_Django_Shell, 'djangoShell');
    }));
    function testExecutionOfSlectionWithoutAnythingSelected(commandId, executionServiceId) {
        return __awaiter(this, void 0, void 0, function* () {
            let commandHandler;
            // tslint:disable-next-line:no-any
            commandManager.setup(c => c.registerCommand).returns(() => {
                // tslint:disable-next-line:no-any
                return (command, callback, _thisArg) => {
                    if (command === commandId) {
                        commandHandler = callback;
                    }
                    return { dispose: () => void 0 };
                };
            });
            executionManager.registerCommands();
            chai_1.expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');
            const helper = TypeMoq.Mock.ofType();
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionHelper))).returns(() => helper.object);
            helper.setup(h => h.getSelectedTextToExecute).returns(() => () => Promise.resolve(''));
            const executionService = TypeMoq.Mock.ofType();
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionService), TypeMoq.It.isValue(executionServiceId))).returns(() => executionService.object);
            // tslint:disable-next-line:no-any
            documentManager.setup(d => d.activeTextEditor).returns(() => { return {}; });
            yield commandHandler();
            executionService.verify((e) => __awaiter(this, void 0, void 0, function* () { return e.execute(TypeMoq.It.isAny()); }), TypeMoq.Times.never());
        });
    }
    test('Ensure executeSelectionInTerminal will do nothing if no text is selected', () => __awaiter(this, void 0, void 0, function* () {
        yield testExecutionOfSlectionWithoutAnythingSelected(constants_1.Commands.Exec_Selection_In_Terminal, 'standard');
    }));
    test('Ensure executeSelectionInDjangoShell will do nothing if no text is selected', () => __awaiter(this, void 0, void 0, function* () {
        yield testExecutionOfSlectionWithoutAnythingSelected(constants_1.Commands.Exec_Selection_In_Django_Shell, 'djangoShell');
    }));
    function testExecutionOfSelectionIsSentToTerminal(commandId, executionServiceId) {
        return __awaiter(this, void 0, void 0, function* () {
            let commandHandler;
            // tslint:disable-next-line:no-any
            commandManager.setup(c => c.registerCommand).returns(() => {
                // tslint:disable-next-line:no-any
                return (command, callback, _thisArg) => {
                    if (command === commandId) {
                        commandHandler = callback;
                    }
                    return { dispose: () => void 0 };
                };
            });
            executionManager.registerCommands();
            chai_1.expect(commandHandler).not.to.be.an('undefined', 'Command handler not initialized');
            const textSelected = 'abcd';
            const activeDocumentUri = vscode_1.Uri.file('abc');
            const helper = TypeMoq.Mock.ofType();
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionHelper))).returns(() => helper.object);
            helper.setup(h => h.getSelectedTextToExecute).returns(() => () => Promise.resolve(textSelected));
            helper.setup(h => h.normalizeLines).returns(() => () => Promise.resolve(textSelected)).verifiable(TypeMoq.Times.once());
            const executionService = TypeMoq.Mock.ofType();
            serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.ICodeExecutionService), TypeMoq.It.isValue(executionServiceId))).returns(() => executionService.object);
            const document = TypeMoq.Mock.ofType();
            document.setup(d => d.uri).returns(() => activeDocumentUri);
            const activeEditor = TypeMoq.Mock.ofType();
            activeEditor.setup(e => e.document).returns(() => document.object);
            documentManager.setup(d => d.activeTextEditor).returns(() => activeEditor.object);
            yield commandHandler();
            executionService.verify((e) => __awaiter(this, void 0, void 0, function* () { return e.execute(TypeMoq.It.isValue(textSelected), TypeMoq.It.isValue(activeDocumentUri)); }), TypeMoq.Times.once());
            helper.verifyAll();
        });
    }
    test('Ensure executeSelectionInTerminal will normalize selected text and send it to the terminal', () => __awaiter(this, void 0, void 0, function* () {
        yield testExecutionOfSelectionIsSentToTerminal(constants_1.Commands.Exec_Selection_In_Terminal, 'standard');
    }));
    test('Ensure executeSelectionInDjangoShell will normalize selected text and send it to the terminal', () => __awaiter(this, void 0, void 0, function* () {
        yield testExecutionOfSelectionIsSentToTerminal(constants_1.Commands.Exec_Selection_In_Django_Shell, 'djangoShell');
    }));
});
//# sourceMappingURL=codeExecutionManager.unit.test.js.map