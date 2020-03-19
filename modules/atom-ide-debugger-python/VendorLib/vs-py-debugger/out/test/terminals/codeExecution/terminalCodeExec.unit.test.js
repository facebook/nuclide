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
// tslint:disable:no-multiline-string no-trailing-whitespace max-func-body-length
const chai_1 = require("chai");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const misc_1 = require("../../../client/common/utils/misc");
const djangoShellCodeExecution_1 = require("../../../client/terminals/codeExecution/djangoShellCodeExecution");
const repl_1 = require("../../../client/terminals/codeExecution/repl");
const terminalCodeExecution_1 = require("../../../client/terminals/codeExecution/terminalCodeExecution");
const common_1 = require("../../common");
suite('Terminal - Code Execution', () => {
    ['Terminal Execution', 'Repl Execution', 'Django Execution'].forEach(testSuiteName => {
        let terminalSettings;
        let terminalService;
        let workspace;
        let platform;
        let workspaceFolder;
        let settings;
        let disposables = [];
        let executor;
        let expectedTerminalTitle;
        let terminalFactory;
        let documentManager;
        let commandManager;
        let fileSystem;
        let isDjangoRepl;
        teardown(() => {
            disposables.forEach(disposable => {
                if (disposable) {
                    disposable.dispose();
                }
            });
            disposables = [];
        });
        setup(() => {
            terminalFactory = TypeMoq.Mock.ofType();
            terminalSettings = TypeMoq.Mock.ofType();
            terminalService = TypeMoq.Mock.ofType();
            const configService = TypeMoq.Mock.ofType();
            workspace = TypeMoq.Mock.ofType();
            platform = TypeMoq.Mock.ofType();
            workspaceFolder = TypeMoq.Mock.ofType();
            documentManager = TypeMoq.Mock.ofType();
            commandManager = TypeMoq.Mock.ofType();
            fileSystem = TypeMoq.Mock.ofType();
            settings = TypeMoq.Mock.ofType();
            settings.setup(s => s.terminal).returns(() => terminalSettings.object);
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
            switch (testSuiteName) {
                case 'Terminal Execution': {
                    executor = new terminalCodeExecution_1.TerminalCodeExecutionProvider(terminalFactory.object, configService.object, workspace.object, disposables, platform.object);
                    break;
                }
                case 'Repl Execution': {
                    executor = new repl_1.ReplProvider(terminalFactory.object, configService.object, workspace.object, disposables, platform.object);
                    expectedTerminalTitle = 'REPL';
                    break;
                }
                case 'Django Execution': {
                    isDjangoRepl = true;
                    workspace.setup(w => w.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
                        return { dispose: misc_1.noop };
                    });
                    executor = new djangoShellCodeExecution_1.DjangoShellCodeExecutionProvider(terminalFactory.object, configService.object, workspace.object, documentManager.object, platform.object, commandManager.object, fileSystem.object, disposables);
                    expectedTerminalTitle = 'Django Shell';
                    break;
                }
                default: {
                    break;
                }
            }
        });
        suite(`${testSuiteName} (validation of title)`, () => {
            setup(() => {
                terminalFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isValue(expectedTerminalTitle))).returns(() => terminalService.object);
            });
            function ensureTerminalIsCreatedUponInvokingInitializeRepl(isWindows, isOsx, isLinux) {
                return __awaiter(this, void 0, void 0, function* () {
                    platform.setup(p => p.isWindows).returns(() => isWindows);
                    platform.setup(p => p.isMac).returns(() => isOsx);
                    platform.setup(p => p.isLinux).returns(() => isLinux);
                    settings.setup(s => s.pythonPath).returns(() => common_1.PYTHON_PATH);
                    terminalSettings.setup(t => t.launchArgs).returns(() => []);
                    yield executor.initializeRepl();
                });
            }
            test('Ensure terminal is created upon invoking initializeRepl (windows)', () => __awaiter(this, void 0, void 0, function* () {
                yield ensureTerminalIsCreatedUponInvokingInitializeRepl(true, false, false);
            }));
            test('Ensure terminal is created upon invoking initializeRepl (osx)', () => __awaiter(this, void 0, void 0, function* () {
                yield ensureTerminalIsCreatedUponInvokingInitializeRepl(false, true, false);
            }));
            test('Ensure terminal is created upon invoking initializeRepl (linux)', () => __awaiter(this, void 0, void 0, function* () {
                yield ensureTerminalIsCreatedUponInvokingInitializeRepl(false, false, true);
            }));
        });
        suite(testSuiteName, function () {
            return __awaiter(this, void 0, void 0, function* () {
                // tslint:disable-next-line:no-invalid-this
                this.timeout(5000); // Activation of terminals take some time (there's a delay in the code to account for VSC Terminal issues).
                setup(() => {
                    terminalFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => terminalService.object);
                });
                function ensureWeSetCurrentDirectoryBeforeExecutingAFile(isWindows) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const file = vscode_1.Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
                        terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
                        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                        workspaceFolder.setup(w => w.uri).returns(() => vscode_1.Uri.file(path.join('c', 'path', 'to')));
                        platform.setup(p => p.isWindows).returns(() => false);
                        settings.setup(s => s.pythonPath).returns(() => common_1.PYTHON_PATH);
                        terminalSettings.setup(t => t.launchArgs).returns(() => []);
                        yield executor.executeFile(file);
                        terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendText(TypeMoq.It.isValue(`cd ${path.dirname(file.fsPath).fileToCommandArgument()}`)); }), TypeMoq.Times.once());
                    });
                }
                test('Ensure we set current directory before executing file (non windows)', () => __awaiter(this, void 0, void 0, function* () {
                    yield ensureWeSetCurrentDirectoryBeforeExecutingAFile(false);
                }));
                test('Ensure we set current directory before executing file (windows)', () => __awaiter(this, void 0, void 0, function* () {
                    yield ensureWeSetCurrentDirectoryBeforeExecutingAFile(true);
                }));
                function ensureWeWetCurrentDirectoryAndQuoteBeforeExecutingFile(isWindows) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const file = vscode_1.Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                        terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
                        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                        workspaceFolder.setup(w => w.uri).returns(() => vscode_1.Uri.file(path.join('c', 'path', 'to')));
                        platform.setup(p => p.isWindows).returns(() => isWindows);
                        settings.setup(s => s.pythonPath).returns(() => common_1.PYTHON_PATH);
                        terminalSettings.setup(t => t.launchArgs).returns(() => []);
                        yield executor.executeFile(file);
                        const dir = path.dirname(file.fsPath).fileToCommandArgument();
                        terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendText(TypeMoq.It.isValue(`cd ${dir}`)); }), TypeMoq.Times.once());
                    });
                }
                test('Ensure we set current directory (and quote it when containing spaces) before executing file (non windows)', () => __awaiter(this, void 0, void 0, function* () {
                    yield ensureWeWetCurrentDirectoryAndQuoteBeforeExecutingFile(false);
                }));
                test('Ensure we set current directory (and quote it when containing spaces) before executing file (windows)', () => __awaiter(this, void 0, void 0, function* () {
                    yield ensureWeWetCurrentDirectoryAndQuoteBeforeExecutingFile(true);
                }));
                function ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileInSameDirectory(isWindows) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const file = vscode_1.Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                        terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
                        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                        workspaceFolder.setup(w => w.uri).returns(() => vscode_1.Uri.file(path.join('c', 'path', 'to', 'file with spaces in path')));
                        platform.setup(p => p.isWindows).returns(() => isWindows);
                        settings.setup(s => s.pythonPath).returns(() => common_1.PYTHON_PATH);
                        terminalSettings.setup(t => t.launchArgs).returns(() => []);
                        yield executor.executeFile(file);
                        terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendText(TypeMoq.It.isAny()); }), TypeMoq.Times.never());
                    });
                }
                test('Ensure we do not set current directory before executing file if in the same directory (non windows)', () => __awaiter(this, void 0, void 0, function* () {
                    yield ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileInSameDirectory(false);
                }));
                test('Ensure we do not set current directory before executing file if in the same directory (windows)', () => __awaiter(this, void 0, void 0, function* () {
                    yield ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileInSameDirectory(true);
                }));
                function ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileNotInSameDirectory(isWindows) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const file = vscode_1.Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                        terminalSettings.setup(t => t.executeInFileDir).returns(() => true);
                        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);
                        platform.setup(p => p.isWindows).returns(() => isWindows);
                        settings.setup(s => s.pythonPath).returns(() => common_1.PYTHON_PATH);
                        terminalSettings.setup(t => t.launchArgs).returns(() => []);
                        yield executor.executeFile(file);
                        terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendText(TypeMoq.It.isAny()); }), TypeMoq.Times.never());
                    });
                }
                test('Ensure we do not set current directory before executing file if file is not in a workspace (non windows)', () => __awaiter(this, void 0, void 0, function* () {
                    yield ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileNotInSameDirectory(false);
                }));
                test('Ensure we do not set current directory before executing file if file is not in a workspace (windows)', () => __awaiter(this, void 0, void 0, function* () {
                    yield ensureWeDoNotSetCurrentDirectoryBeforeExecutingFileNotInSameDirectory(true);
                }));
                function testFileExecution(isWindows, pythonPath, terminalArgs, file) {
                    return __awaiter(this, void 0, void 0, function* () {
                        platform.setup(p => p.isWindows).returns(() => isWindows);
                        settings.setup(s => s.pythonPath).returns(() => pythonPath);
                        terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
                        terminalSettings.setup(t => t.executeInFileDir).returns(() => false);
                        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);
                        yield executor.executeFile(file);
                        const expectedPythonPath = isWindows ? pythonPath.replace(/\\/g, '/') : pythonPath;
                        const expectedArgs = terminalArgs.concat(file.fsPath.fileToCommandArgument());
                        terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendCommand(TypeMoq.It.isValue(expectedPythonPath), TypeMoq.It.isValue(expectedArgs)); }), TypeMoq.Times.once());
                    });
                }
                test('Ensure python file execution script is sent to terminal on windows', () => __awaiter(this, void 0, void 0, function* () {
                    const file = vscode_1.Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                    yield testFileExecution(true, common_1.PYTHON_PATH, [], file);
                }));
                test('Ensure python file execution script is sent to terminal on windows with fully qualified python path', () => __awaiter(this, void 0, void 0, function* () {
                    const file = vscode_1.Uri.file(path.join('c', 'path', 'to', 'file with spaces in path', 'one.py'));
                    yield testFileExecution(true, 'c:\\program files\\python', [], file);
                }));
                test('Ensure python file execution script is not quoted when no spaces in file path', () => __awaiter(this, void 0, void 0, function* () {
                    const file = vscode_1.Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
                    yield testFileExecution(true, common_1.PYTHON_PATH, [], file);
                }));
                test('Ensure python file execution script supports custom python arguments', () => __awaiter(this, void 0, void 0, function* () {
                    const file = vscode_1.Uri.file(path.join('c', 'path', 'to', 'file', 'one.py'));
                    yield testFileExecution(false, common_1.PYTHON_PATH, ['-a', '-b', '-c'], file);
                }));
                function testReplCommandArguments(isWindows, pythonPath, expectedPythonPath, terminalArgs) {
                    platform.setup(p => p.isWindows).returns(() => isWindows);
                    settings.setup(s => s.pythonPath).returns(() => pythonPath);
                    terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
                    const expectedTerminalArgs = isDjangoRepl ? terminalArgs.concat(['manage.py', 'shell']) : terminalArgs;
                    const replCommandArgs = executor.getReplCommandArgs();
                    chai_1.expect(replCommandArgs).not.to.be.an('undefined', 'Command args is undefined');
                    chai_1.expect(replCommandArgs.command).to.be.equal(expectedPythonPath, 'Incorrect python path');
                    chai_1.expect(replCommandArgs.args).to.be.deep.equal(expectedTerminalArgs, 'Incorrect arguments');
                }
                test('Ensure fully qualified python path is escaped when building repl args on Windows', () => {
                    const pythonPath = 'c:\\program files\\python\\python.exe';
                    const terminalArgs = ['-a', 'b', 'c'];
                    testReplCommandArguments(true, pythonPath, 'c:/program files/python/python.exe', terminalArgs);
                });
                test('Ensure fully qualified python path is returned as is, when building repl args on Windows', () => {
                    const pythonPath = 'c:/program files/python/python.exe';
                    const terminalArgs = ['-a', 'b', 'c'];
                    testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs);
                });
                test('Ensure python path is returned as is, when building repl args on Windows', () => {
                    const pythonPath = common_1.PYTHON_PATH;
                    const terminalArgs = ['-a', 'b', 'c'];
                    testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs);
                });
                test('Ensure fully qualified python path is returned as is, on non Windows', () => {
                    const pythonPath = 'usr/bin/python';
                    const terminalArgs = ['-a', 'b', 'c'];
                    testReplCommandArguments(false, pythonPath, pythonPath, terminalArgs);
                });
                test('Ensure python path is returned as is, on non Windows', () => {
                    const pythonPath = common_1.PYTHON_PATH;
                    const terminalArgs = ['-a', 'b', 'c'];
                    testReplCommandArguments(false, pythonPath, pythonPath, terminalArgs);
                });
                test('Ensure nothing happens when blank text is sent to the terminal', () => __awaiter(this, void 0, void 0, function* () {
                    yield executor.execute('');
                    yield executor.execute('   ');
                    // tslint:disable-next-line:no-any
                    yield executor.execute(undefined);
                    terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()); }), TypeMoq.Times.never());
                    terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendText(TypeMoq.It.isAny()); }), TypeMoq.Times.never());
                }));
                test('Ensure repl is initialized once before sending text to the repl', () => __awaiter(this, void 0, void 0, function* () {
                    const pythonPath = 'usr/bin/python1234';
                    const terminalArgs = ['-a', 'b', 'c'];
                    platform.setup(p => p.isWindows).returns(() => false);
                    settings.setup(s => s.pythonPath).returns(() => pythonPath);
                    terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
                    yield executor.execute('cmd1');
                    yield executor.execute('cmd2');
                    yield executor.execute('cmd3');
                    const expectedTerminalArgs = isDjangoRepl ? terminalArgs.concat(['manage.py', 'shell']) : terminalArgs;
                    terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(expectedTerminalArgs)); }), TypeMoq.Times.once());
                }));
                test('Ensure repl is re-initialized when terminal is closed', () => __awaiter(this, void 0, void 0, function* () {
                    const pythonPath = 'usr/bin/python1234';
                    const terminalArgs = ['-a', 'b', 'c'];
                    platform.setup(p => p.isWindows).returns(() => false);
                    settings.setup(s => s.pythonPath).returns(() => pythonPath);
                    terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
                    let closeTerminalCallback;
                    terminalService.setup(t => t.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((callback => {
                        closeTerminalCallback = callback;
                        return {
                            dispose: misc_1.noop
                        };
                    }));
                    yield executor.execute('cmd1');
                    yield executor.execute('cmd2');
                    yield executor.execute('cmd3');
                    const expectedTerminalArgs = isDjangoRepl ? terminalArgs.concat(['manage.py', 'shell']) : terminalArgs;
                    chai_1.expect(closeTerminalCallback).not.to.be.an('undefined', 'Callback not initialized');
                    terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(expectedTerminalArgs)); }), TypeMoq.Times.once());
                    closeTerminalCallback.call(terminalService.object);
                    yield executor.execute('cmd4');
                    terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(expectedTerminalArgs)); }), TypeMoq.Times.exactly(2));
                    closeTerminalCallback.call(terminalService.object);
                    yield executor.execute('cmd5');
                    terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendCommand(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(expectedTerminalArgs)); }), TypeMoq.Times.exactly(3));
                }));
                test('Ensure code is sent to terminal', () => __awaiter(this, void 0, void 0, function* () {
                    const pythonPath = 'usr/bin/python1234';
                    const terminalArgs = ['-a', 'b', 'c'];
                    platform.setup(p => p.isWindows).returns(() => false);
                    settings.setup(s => s.pythonPath).returns(() => pythonPath);
                    terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);
                    yield executor.execute('cmd1');
                    terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendText('cmd1'); }), TypeMoq.Times.once());
                    yield executor.execute('cmd2');
                    terminalService.verify((t) => __awaiter(this, void 0, void 0, function* () { return t.sendText('cmd2'); }), TypeMoq.Times.once());
                }));
            });
        });
    });
});
//# sourceMappingURL=terminalCodeExec.unit.test.js.map