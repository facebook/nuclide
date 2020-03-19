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
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const djangoShellCodeExecution_1 = require("../../../client/terminals/codeExecution/djangoShellCodeExecution");
const common_1 = require("../../common");
// tslint:disable-next-line:max-func-body-length
suite('Terminal - Django Shell Code Execution', () => {
    let executor;
    let terminalSettings;
    let terminalService;
    let workspace;
    let platform;
    let settings;
    let disposables = [];
    setup(() => {
        const terminalFactory = TypeMoq.Mock.ofType();
        terminalSettings = TypeMoq.Mock.ofType();
        terminalService = TypeMoq.Mock.ofType();
        const configService = TypeMoq.Mock.ofType();
        workspace = TypeMoq.Mock.ofType();
        workspace.setup(c => c.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
            return {
                dispose: () => void 0
            };
        });
        platform = TypeMoq.Mock.ofType();
        const documentManager = TypeMoq.Mock.ofType();
        const commandManager = TypeMoq.Mock.ofType();
        const fileSystem = TypeMoq.Mock.ofType();
        executor = new djangoShellCodeExecution_1.DjangoShellCodeExecutionProvider(terminalFactory.object, configService.object, workspace.object, documentManager.object, platform.object, commandManager.object, fileSystem.object, disposables);
        terminalFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny())).returns(() => terminalService.object);
        settings = TypeMoq.Mock.ofType();
        settings.setup(s => s.terminal).returns(() => terminalSettings.object);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
        disposables = [];
    });
    function testReplCommandArguments(isWindows, pythonPath, expectedPythonPath, terminalArgs, expectedTerminalArgs, resource) {
        platform.setup(p => p.isWindows).returns(() => isWindows);
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
        const replCommandArgs = executor.getReplCommandArgs(resource);
        chai_1.expect(replCommandArgs).not.to.be.an('undefined', 'Command args is undefined');
        chai_1.expect(replCommandArgs.command).to.be.equal(expectedPythonPath, 'Incorrect python path');
        chai_1.expect(replCommandArgs.args).to.be.deep.equal(expectedTerminalArgs, 'Incorrect arguments');
    }
    test('Ensure fully qualified python path is escaped when building repl args on Windows', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = 'c:\\program files\\python\\python.exe';
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');
        testReplCommandArguments(true, pythonPath, 'c:/program files/python/python.exe', terminalArgs, expectedTerminalArgs);
    }));
    test('Ensure fully qualified python path is returned as is, when building repl args on Windows', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = 'c:/program files/python/python.exe';
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');
        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs);
    }));
    test('Ensure python path is returned as is, when building repl args on Windows', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = common_1.PYTHON_PATH;
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');
        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs);
    }));
    test('Ensure fully qualified python path is returned as is, on non Windows', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = 'usr/bin/python';
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');
        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs);
    }));
    test('Ensure python path is returned as is, on non Windows', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = common_1.PYTHON_PATH;
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');
        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs);
    }));
    test('Ensure current workspace folder (containing spaces) is used to prefix manage.py', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = 'python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        const workspaceUri = vscode_1.Uri.file(path.join('c', 'usr', 'program files'));
        const workspaceFolder = { index: 0, name: 'blah', uri: workspaceUri };
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder);
        const expectedTerminalArgs = terminalArgs.concat(`${path.join(workspaceUri.fsPath, 'manage.py').fileToCommandArgument()}`, 'shell');
        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs, vscode_1.Uri.file('x'));
    }));
    test('Ensure current workspace folder (without spaces) is used to prefix manage.py', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = 'python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        const workspaceUri = vscode_1.Uri.file(path.join('c', 'usr', 'programfiles'));
        const workspaceFolder = { index: 0, name: 'blah', uri: workspaceUri };
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder);
        const expectedTerminalArgs = terminalArgs.concat(path.join(workspaceUri.fsPath, 'manage.py').fileToCommandArgument(), 'shell');
        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs, vscode_1.Uri.file('x'));
    }));
    test('Ensure default workspace folder (containing spaces) is used to prefix manage.py', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = 'python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        const workspaceUri = vscode_1.Uri.file(path.join('c', 'usr', 'program files'));
        const workspaceFolder = { index: 0, name: 'blah', uri: workspaceUri };
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);
        workspace.setup(w => w.workspaceFolders).returns(() => [workspaceFolder]);
        const expectedTerminalArgs = terminalArgs.concat(`${path.join(workspaceUri.fsPath, 'manage.py').fileToCommandArgument()}`, 'shell');
        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs, vscode_1.Uri.file('x'));
    }));
    test('Ensure default workspace folder (without spaces) is used to prefix manage.py', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = 'python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        const workspaceUri = vscode_1.Uri.file(path.join('c', 'usr', 'programfiles'));
        const workspaceFolder = { index: 0, name: 'blah', uri: workspaceUri };
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);
        workspace.setup(w => w.workspaceFolders).returns(() => [workspaceFolder]);
        const expectedTerminalArgs = terminalArgs.concat(path.join(workspaceUri.fsPath, 'manage.py').fileToCommandArgument(), 'shell');
        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs, vscode_1.Uri.file('x'));
    }));
});
//# sourceMappingURL=djangoShellCodeExect.unit.test.js.map