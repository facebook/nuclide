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
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const types_1 = require("../../../client/common/application/types");
const types_2 = require("../../../client/common/platform/types");
const helper_1 = require("../../../client/common/terminal/helper");
const types_3 = require("../../../client/common/terminal/types");
const types_4 = require("../../../client/common/types");
const enum_1 = require("../../../client/common/utils/enum");
const contracts_1 = require("../../../client/interpreter/contracts");
// tslint:disable-next-line:max-func-body-length
suite('Terminal Service helpers', () => {
    let helper;
    let terminalManager;
    let platformService;
    let workspaceService;
    let disposables = [];
    let serviceContainer;
    let interpreterService;
    setup(() => {
        terminalManager = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        workspaceService = TypeMoq.Mock.ofType();
        interpreterService = TypeMoq.Mock.ofType();
        disposables = [];
        serviceContainer = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(types_1.ITerminalManager)).returns(() => terminalManager.object);
        serviceContainer.setup(c => c.get(types_2.IPlatformService)).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(types_4.IDisposableRegistry)).returns(() => disposables);
        serviceContainer.setup(c => c.get(types_1.IWorkspaceService)).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(contracts_1.IInterpreterService)).returns(() => interpreterService.object);
        helper = new helper_1.TerminalHelper(serviceContainer.object);
    });
    teardown(() => {
        disposables.filter(item => !!item).forEach(item => item.dispose());
    });
    test('Test identification of Terminal Shells', () => __awaiter(this, void 0, void 0, function* () {
        const shellPathsAndIdentification = new Map();
        shellPathsAndIdentification.set('c:\\windows\\system32\\cmd.exe', types_3.TerminalShellType.commandPrompt);
        shellPathsAndIdentification.set('c:\\windows\\system32\\bash.exe', types_3.TerminalShellType.bash);
        shellPathsAndIdentification.set('c:\\windows\\system32\\wsl.exe', types_3.TerminalShellType.wsl);
        shellPathsAndIdentification.set('c:\\windows\\system32\\gitbash.exe', types_3.TerminalShellType.gitbash);
        shellPathsAndIdentification.set('/usr/bin/bash', types_3.TerminalShellType.bash);
        shellPathsAndIdentification.set('/usr/bin/zsh', types_3.TerminalShellType.zsh);
        shellPathsAndIdentification.set('/usr/bin/ksh', types_3.TerminalShellType.ksh);
        shellPathsAndIdentification.set('c:\\windows\\system32\\powershell.exe', types_3.TerminalShellType.powershell);
        shellPathsAndIdentification.set('c:\\windows\\system32\\pwsh.exe', types_3.TerminalShellType.powershellCore);
        shellPathsAndIdentification.set('/usr/microsoft/xxx/powershell/powershell', types_3.TerminalShellType.powershell);
        shellPathsAndIdentification.set('/usr/microsoft/xxx/powershell/pwsh', types_3.TerminalShellType.powershellCore);
        shellPathsAndIdentification.set('/usr/bin/fish', types_3.TerminalShellType.fish);
        shellPathsAndIdentification.set('c:\\windows\\system32\\shell.exe', types_3.TerminalShellType.other);
        shellPathsAndIdentification.set('/usr/bin/shell', types_3.TerminalShellType.other);
        shellPathsAndIdentification.set('/usr/bin/csh', types_3.TerminalShellType.cshell);
        shellPathsAndIdentification.set('/usr/bin/tcsh', types_3.TerminalShellType.tcshell);
        shellPathsAndIdentification.forEach((shellType, shellPath) => {
            chai_1.expect(helper.identifyTerminalShell(shellPath)).to.equal(shellType, `Incorrect Shell Type for path '${shellPath}'`);
        });
    }));
    function ensurePathForShellIsCorrectlyRetrievedFromSettings(os, expectedShellPat) {
        return __awaiter(this, void 0, void 0, function* () {
            const shellPath = 'abcd';
            workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('terminal.integrated.shell'))).returns(() => {
                const workspaceConfig = TypeMoq.Mock.ofType();
                workspaceConfig.setup(c => c.get(os)).returns(() => shellPath);
                return workspaceConfig.object;
            });
            platformService.setup(p => p.isWindows).returns(() => os === 'windows');
            platformService.setup(p => p.isLinux).returns(() => os === 'linux');
            platformService.setup(p => p.isMac).returns(() => os === 'osx');
            chai_1.expect(helper.getTerminalShellPath()).to.equal(shellPath, 'Incorrect path for Osx');
        });
    }
    test('Ensure path for shell is correctly retrieved from settings (osx)', () => __awaiter(this, void 0, void 0, function* () {
        yield ensurePathForShellIsCorrectlyRetrievedFromSettings('osx', 'abcd');
    }));
    test('Ensure path for shell is correctly retrieved from settings (linux)', () => __awaiter(this, void 0, void 0, function* () {
        yield ensurePathForShellIsCorrectlyRetrievedFromSettings('linux', 'abcd');
    }));
    test('Ensure path for shell is correctly retrieved from settings (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield ensurePathForShellIsCorrectlyRetrievedFromSettings('windows', 'abcd');
    }));
    test('Ensure path for shell is correctly retrieved from settings (unknown os)', () => __awaiter(this, void 0, void 0, function* () {
        yield ensurePathForShellIsCorrectlyRetrievedFromSettings('windows', '');
    }));
    test('Ensure spaces in command is quoted', () => __awaiter(this, void 0, void 0, function* () {
        enum_1.getNamesAndValues(types_3.TerminalShellType).forEach(item => {
            const command = 'c:\\python 3.7.exe';
            const args = ['1', '2'];
            const commandPrefix = (item.value === types_3.TerminalShellType.powershell || item.value === types_3.TerminalShellType.powershellCore) ? '& ' : '';
            const expectedTerminalCommand = `${commandPrefix}${command.fileToCommandArgument()} 1 2`;
            const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
            chai_1.expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
        });
    }));
    test('Ensure empty args are ignored', () => __awaiter(this, void 0, void 0, function* () {
        enum_1.getNamesAndValues(types_3.TerminalShellType).forEach(item => {
            const command = 'python3.7.exe';
            const args = [];
            const commandPrefix = (item.value === types_3.TerminalShellType.powershell || item.value === types_3.TerminalShellType.powershellCore) ? '& ' : '';
            const expectedTerminalCommand = `${commandPrefix}${command}`;
            const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
            chai_1.expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell '${item.name}'`);
        });
    }));
    test('Ensure empty args are ignored with s in command', () => __awaiter(this, void 0, void 0, function* () {
        enum_1.getNamesAndValues(types_3.TerminalShellType).forEach(item => {
            const command = 'c:\\python 3.7.exe';
            const args = [];
            const commandPrefix = (item.value === types_3.TerminalShellType.powershell || item.value === types_3.TerminalShellType.powershellCore) ? '& ' : '';
            const expectedTerminalCommand = `${commandPrefix}${command.fileToCommandArgument()}`;
            const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
            chai_1.expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
        });
    }));
    test('Ensure a terminal is created (without a title)', () => {
        helper.createTerminal();
        terminalManager.verify(t => t.createTerminal(TypeMoq.It.isValue({ name: undefined })), TypeMoq.Times.once());
    });
    test('Ensure a terminal is created with the provided title', () => {
        helper.createTerminal('1234');
        terminalManager.verify(t => t.createTerminal(TypeMoq.It.isValue({ name: '1234' })), TypeMoq.Times.once());
    });
});
//# sourceMappingURL=helper.unit.test.js.map