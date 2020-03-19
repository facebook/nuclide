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
const service_1 = require("../../../client/common/terminal/service");
const types_3 = require("../../../client/common/terminal/types");
const types_4 = require("../../../client/common/types");
// tslint:disable-next-line:max-func-body-length
suite('Terminal Service', () => {
    let service;
    let terminal;
    let terminalManager;
    let terminalHelper;
    let terminalActivator;
    let platformService;
    let workspaceService;
    let disposables = [];
    let mockServiceContainer;
    setup(() => {
        terminal = TypeMoq.Mock.ofType();
        terminalManager = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        workspaceService = TypeMoq.Mock.ofType();
        terminalHelper = TypeMoq.Mock.ofType();
        terminalActivator = TypeMoq.Mock.ofType();
        disposables = [];
        mockServiceContainer = TypeMoq.Mock.ofType();
        mockServiceContainer.setup(c => c.get(types_1.ITerminalManager)).returns(() => terminalManager.object);
        mockServiceContainer.setup(c => c.get(types_3.ITerminalHelper)).returns(() => terminalHelper.object);
        mockServiceContainer.setup(c => c.get(types_2.IPlatformService)).returns(() => platformService.object);
        mockServiceContainer.setup(c => c.get(types_4.IDisposableRegistry)).returns(() => disposables);
        mockServiceContainer.setup(c => c.get(types_1.IWorkspaceService)).returns(() => workspaceService.object);
        mockServiceContainer.setup(c => c.get(types_3.ITerminalActivator)).returns(() => terminalActivator.object);
    });
    teardown(() => {
        if (service) {
            // tslint:disable-next-line:no-any
            service.dispose();
        }
        disposables.filter(item => !!item).forEach(item => item.dispose());
    });
    test('Ensure terminal is disposed', () => __awaiter(this, void 0, void 0, function* () {
        terminalHelper.setup(helper => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        const os = 'windows';
        service = new service_1.TerminalService(mockServiceContainer.object);
        const shellPath = 'powershell.exe';
        workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('terminal.integrated.shell'))).returns(() => {
            const workspaceConfig = TypeMoq.Mock.ofType();
            workspaceConfig.setup(c => c.get(os)).returns(() => shellPath);
            return workspaceConfig.object;
        });
        platformService.setup(p => p.isWindows).returns(() => os === 'windows');
        platformService.setup(p => p.isLinux).returns(() => os === 'linux');
        platformService.setup(p => p.isMac).returns(() => os === 'osx');
        terminalManager.setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        terminalHelper.setup(h => h.buildCommandForTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => 'dummy text');
        // Sending a command will cause the terminal to be created
        yield service.sendCommand('', []);
        terminal.verify(t => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(2));
        service.dispose();
        terminal.verify(t => t.dispose(), TypeMoq.Times.exactly(1));
    }));
    test('Ensure command is sent to terminal and it is shown', () => __awaiter(this, void 0, void 0, function* () {
        terminalHelper.setup(helper => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        service = new service_1.TerminalService(mockServiceContainer.object);
        const commandToSend = 'SomeCommand';
        const args = ['1', '2'];
        const commandToExpect = [commandToSend].concat(args).join(' ');
        terminalHelper.setup(h => h.buildCommandForTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => commandToExpect);
        terminalHelper.setup(h => h.getTerminalShellPath()).returns(() => '');
        terminalHelper.setup(h => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => types_3.TerminalShellType.bash);
        terminalManager.setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        yield service.sendCommand(commandToSend, args);
        terminal.verify(t => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(2));
        terminal.verify(t => t.sendText(TypeMoq.It.isValue(commandToExpect), TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(1));
    }));
    test('Ensure text is sent to terminal and it is shown', () => __awaiter(this, void 0, void 0, function* () {
        terminalHelper.setup(helper => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        service = new service_1.TerminalService(mockServiceContainer.object);
        const textToSend = 'Some Text';
        terminalHelper.setup(h => h.getTerminalShellPath()).returns(() => '');
        terminalHelper.setup(h => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => types_3.TerminalShellType.bash);
        terminalManager.setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        yield service.sendText(textToSend);
        terminal.verify(t => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(2));
        terminal.verify(t => t.sendText(TypeMoq.It.isValue(textToSend)), TypeMoq.Times.exactly(1));
    }));
    test('Ensure terminal shown', () => __awaiter(this, void 0, void 0, function* () {
        terminalHelper.setup(helper => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        service = new service_1.TerminalService(mockServiceContainer.object);
        terminalHelper.setup(h => h.getTerminalShellPath()).returns(() => '');
        terminalHelper.setup(h => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => types_3.TerminalShellType.bash);
        terminalManager.setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        yield service.show();
        terminal.verify(t => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(2));
    }));
    test('Ensure terminal shown and focus is set to the Terminal', () => __awaiter(this, void 0, void 0, function* () {
        terminalHelper.setup(helper => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        service = new service_1.TerminalService(mockServiceContainer.object);
        terminalHelper.setup(h => h.getTerminalShellPath()).returns(() => '');
        terminalHelper.setup(h => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => types_3.TerminalShellType.bash);
        terminalManager.setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        yield service.show(false);
        terminal.verify(t => t.show(TypeMoq.It.isValue(false)), TypeMoq.Times.exactly(2));
    }));
    test('Ensure terminal is activated once after creation', () => __awaiter(this, void 0, void 0, function* () {
        service = new service_1.TerminalService(mockServiceContainer.object);
        terminalHelper
            .setup(h => h.getTerminalShellPath()).returns(() => '')
            .verifiable(TypeMoq.Times.once());
        terminalActivator
            .setup(h => h.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        terminalManager
            .setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object)
            .verifiable(TypeMoq.Times.atLeastOnce());
        yield service.show();
        yield service.show();
        yield service.show();
        yield service.show();
        terminalHelper.verifyAll();
        terminalActivator.verifyAll();
        terminal.verify(t => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.atLeastOnce());
    }));
    test('Ensure terminal is activated once before sending text', () => __awaiter(this, void 0, void 0, function* () {
        service = new service_1.TerminalService(mockServiceContainer.object);
        const textToSend = 'Some Text';
        terminalHelper
            .setup(h => h.getTerminalShellPath()).returns(() => '')
            .verifiable(TypeMoq.Times.once());
        terminalActivator
            .setup(h => h.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        terminalManager
            .setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object)
            .verifiable(TypeMoq.Times.atLeastOnce());
        yield service.sendText(textToSend);
        yield service.sendText(textToSend);
        yield service.sendText(textToSend);
        yield service.sendText(textToSend);
        terminalHelper.verifyAll();
        terminalActivator.verifyAll();
        terminal.verify(t => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.atLeastOnce());
    }));
    test('Ensure close event is not fired when another terminal is closed', () => __awaiter(this, void 0, void 0, function* () {
        terminalHelper.setup(helper => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        let eventFired = false;
        let eventHandler;
        terminalManager.setup(m => m.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
            eventHandler = handler;
            // tslint:disable-next-line:no-empty
            return { dispose: () => { } };
        });
        service = new service_1.TerminalService(mockServiceContainer.object);
        service.onDidCloseTerminal(() => eventFired = true, service);
        terminalHelper.setup(h => h.getTerminalShellPath()).returns(() => '');
        terminalHelper.setup(h => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => types_3.TerminalShellType.bash);
        terminalManager.setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        // This will create the terminal.
        yield service.sendText('blah');
        chai_1.expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');
        eventHandler.bind(service)();
        chai_1.expect(eventFired).to.be.equal(false, 'Event fired');
    }));
    test('Ensure close event is not fired when terminal is closed', () => __awaiter(this, void 0, void 0, function* () {
        terminalHelper.setup(helper => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
        let eventFired = false;
        let eventHandler;
        terminalManager.setup(m => m.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
            eventHandler = handler;
            // tslint:disable-next-line:no-empty
            return { dispose: () => { } };
        });
        service = new service_1.TerminalService(mockServiceContainer.object);
        service.onDidCloseTerminal(() => eventFired = true);
        terminalHelper.setup(h => h.getTerminalShellPath()).returns(() => '');
        terminalHelper.setup(h => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => types_3.TerminalShellType.bash);
        terminalManager.setup(t => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        // This will create the terminal.
        yield service.sendText('blah');
        chai_1.expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');
        eventHandler.bind(service)(terminal.object);
        chai_1.expect(eventFired).to.be.equal(true, 'Event not fired');
    }));
});
//# sourceMappingURL=service.unit.test.js.map