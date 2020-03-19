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
const bash_1 = require("../../../client/common/terminal/environmentActivationProviders/bash");
const commandPrompt_1 = require("../../../client/common/terminal/environmentActivationProviders/commandPrompt");
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
    let terminalSettings;
    setup(() => {
        terminalManager = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        workspaceService = TypeMoq.Mock.ofType();
        interpreterService = TypeMoq.Mock.ofType();
        terminalSettings = TypeMoq.Mock.ofType();
        disposables = [];
        serviceContainer = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(types_1.ITerminalManager)).returns(() => terminalManager.object);
        serviceContainer.setup(c => c.get(types_2.IPlatformService)).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(types_4.IDisposableRegistry)).returns(() => disposables);
        serviceContainer.setup(c => c.get(types_1.IWorkspaceService)).returns(() => workspaceService.object);
        serviceContainer.setup(c => c.get(contracts_1.IInterpreterService)).returns(() => interpreterService.object);
        const configService = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(types_4.IConfigurationService)).returns(() => configService.object);
        const settings = TypeMoq.Mock.ofType();
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        settings.setup(s => s.terminal).returns(() => terminalSettings.object);
        const condaService = TypeMoq.Mock.ofType();
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.ICondaService))).returns(() => condaService.object);
        helper = new helper_1.TerminalHelper(serviceContainer.object);
    });
    teardown(() => {
        disposables.filter(item => !!item).forEach(item => item.dispose());
    });
    test('Activation command is undefined when terminal activation is disabled', () => __awaiter(this, void 0, void 0, function* () {
        terminalSettings.setup(t => t.activateEnvironment).returns(() => false);
        const commands = yield helper.getEnvironmentActivationCommands(types_3.TerminalShellType.other);
        chai_1.expect(commands).to.equal(undefined, 'Activation command should be undefined if terminal type cannot be determined');
    }));
    test('Activation command is undefined for unknown terminal', () => __awaiter(this, void 0, void 0, function* () {
        terminalSettings.setup(t => t.activateEnvironment).returns(() => true);
        const bashActivation = new bash_1.Bash(serviceContainer.object);
        const commandPromptActivation = new commandPrompt_1.CommandPromptAndPowerShell(serviceContainer.object);
        serviceContainer.setup(c => c.getAll(types_3.ITerminalActivationCommandProvider)).returns(() => [bashActivation, commandPromptActivation]);
        const commands = yield helper.getEnvironmentActivationCommands(types_3.TerminalShellType.other);
        chai_1.expect(commands).to.equal(undefined, 'Activation command should be undefined if terminal type cannot be determined');
    }));
});
enum_1.getNamesAndValues(types_3.TerminalShellType).forEach(terminalShell => {
    suite(`Terminal Service helpers (${terminalShell.name})`, () => {
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
            const configService = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(types_4.IConfigurationService)).returns(() => configService.object);
            const settings = TypeMoq.Mock.ofType();
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
            const terminalSettings = TypeMoq.Mock.ofType();
            settings.setup(s => s.terminal).returns(() => terminalSettings.object);
            terminalSettings.setup(t => t.activateEnvironment).returns(() => true);
            const condaService = TypeMoq.Mock.ofType();
            condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.ICondaService))).returns(() => condaService.object);
            helper = new helper_1.TerminalHelper(serviceContainer.object);
        });
        teardown(() => {
            disposables.filter(disposable => !!disposable).forEach(disposable => disposable.dispose());
        });
        function activationCommandShouldReturnCorrectly(shellType, expectedActivationCommand) {
            return __awaiter(this, void 0, void 0, function* () {
                // This will only work for the current shell type.
                const validProvider = TypeMoq.Mock.ofType();
                validProvider.setup(p => p.isShellSupported(TypeMoq.It.isValue(shellType))).returns(() => true);
                validProvider.setup(p => p.getActivationCommands(TypeMoq.It.isValue(undefined), TypeMoq.It.isValue(shellType))).returns(() => Promise.resolve(expectedActivationCommand));
                // This will support other providers.
                const invalidProvider = TypeMoq.Mock.ofType();
                invalidProvider.setup(p => p.isShellSupported(TypeMoq.It.isAny())).returns(item => shellType !== shellType);
                serviceContainer.setup(c => c.getAll(types_3.ITerminalActivationCommandProvider)).returns(() => [validProvider.object, invalidProvider.object]);
                const commands = yield helper.getEnvironmentActivationCommands(shellType);
                validProvider.verify(p => p.getActivationCommands(TypeMoq.It.isValue(undefined), TypeMoq.It.isValue(shellType)), TypeMoq.Times.once());
                validProvider.verify(p => p.isShellSupported(TypeMoq.It.isValue(shellType)), TypeMoq.Times.once());
                invalidProvider.verify(p => p.getActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
                invalidProvider.verify(p => p.isShellSupported(TypeMoq.It.isValue(shellType)), TypeMoq.Times.once());
                chai_1.expect(commands).to.deep.equal(expectedActivationCommand, 'Incorrect activation command');
            });
        }
        test(`Activation command should be correctly identified for ${terminalShell.name} (command array)`, () => __awaiter(this, void 0, void 0, function* () {
            yield activationCommandShouldReturnCorrectly(terminalShell.value, ['a', 'b']);
        }));
        test(`Activation command should be correctly identified for ${terminalShell.name} (command string)`, () => __awaiter(this, void 0, void 0, function* () {
            yield activationCommandShouldReturnCorrectly(terminalShell.value, ['command to be executed']);
        }));
        test(`Activation command should be correctly identified for ${terminalShell.name} (undefined)`, () => __awaiter(this, void 0, void 0, function* () {
            yield activationCommandShouldReturnCorrectly(terminalShell.value);
        }));
        function activationCommandShouldReturnUndefined(shellType) {
            return __awaiter(this, void 0, void 0, function* () {
                // This will support other providers.
                const invalidProvider = TypeMoq.Mock.ofType();
                invalidProvider.setup(p => p.isShellSupported(TypeMoq.It.isAny())).returns(item => shellType !== shellType);
                serviceContainer.setup(c => c.getAll(types_3.ITerminalActivationCommandProvider)).returns(() => [invalidProvider.object]);
                const commands = yield helper.getEnvironmentActivationCommands(shellType);
                invalidProvider.verify(p => p.getActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
                chai_1.expect(commands).to.deep.equal(undefined, 'Incorrect activation command');
            });
        }
        test(`Activation command should return undefined ${terminalShell.name} (no matching providers)`, () => __awaiter(this, void 0, void 0, function* () {
            yield activationCommandShouldReturnUndefined(terminalShell.value);
        }));
    });
});
//# sourceMappingURL=helper.activation.unit.test.js.map