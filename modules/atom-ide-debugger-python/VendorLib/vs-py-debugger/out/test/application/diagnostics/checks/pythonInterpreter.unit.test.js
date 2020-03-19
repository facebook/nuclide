// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:max-func-body-length no-any max-classes-per-file
const chai_1 = require("chai");
const typemoq = require("typemoq");
const pythonInterpreter_1 = require("../../../../client/application/diagnostics/checks/pythonInterpreter");
const types_1 = require("../../../../client/application/diagnostics/commands/types");
const constants_1 = require("../../../../client/application/diagnostics/constants");
const promptHandler_1 = require("../../../../client/application/diagnostics/promptHandler");
const types_2 = require("../../../../client/application/diagnostics/types");
const types_3 = require("../../../../client/common/application/types");
const types_4 = require("../../../../client/common/platform/types");
const types_5 = require("../../../../client/common/types");
const misc_1 = require("../../../../client/common/utils/misc");
const contracts_1 = require("../../../../client/interpreter/contracts");
const core_1 = require("../../../core");
suite('Application Diagnostics - Checks Python Interpreter', () => {
    let diagnosticService;
    let messageHandler;
    let commandFactory;
    let settings;
    let interpreterService;
    let platformService;
    let helper;
    const pythonPath = 'My Python Path in Settings';
    let serviceContainer;
    function createContainer() {
        serviceContainer = typemoq.Mock.ofType();
        messageHandler = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IDiagnosticHandlerService), typemoq.It.isValue(promptHandler_1.DiagnosticCommandPromptHandlerServiceId)))
            .returns(() => messageHandler.object);
        commandFactory = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_1.IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        settings = typemoq.Mock.ofType();
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        const configService = typemoq.Mock.ofType();
        configService.setup(c => c.getSettings(typemoq.It.isAny())).returns(() => settings.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_5.IConfigurationService)))
            .returns(() => configService.object);
        interpreterService = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(contracts_1.IInterpreterService)))
            .returns(() => interpreterService.object);
        platformService = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_4.IPlatformService)))
            .returns(() => platformService.object);
        helper = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(contracts_1.IInterpreterHelper)))
            .returns(() => helper.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_5.IDisposableRegistry)))
            .returns(() => []);
        return serviceContainer.object;
    }
    suite('Diagnostics', () => {
        setup(() => {
            diagnosticService = new class extends pythonInterpreter_1.InvalidPythonInterpreterService {
                addPythonPathChangedHandler() { misc_1.noop(); }
            }(createContainer());
        });
        test('Can handle InvalidPythonPathInterpreter diagnostics', () => __awaiter(this, void 0, void 0, function* () {
            for (const code of [
                constants_1.DiagnosticCodes.NoPythonInterpretersDiagnostic,
                constants_1.DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
                constants_1.DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic
            ]) {
                const diagnostic = typemoq.Mock.ofType();
                diagnostic.setup(d => d.code)
                    .returns(() => code)
                    .verifiable(typemoq.Times.atLeastOnce());
                const canHandle = yield diagnosticService.canHandle(diagnostic.object);
                chai_1.expect(canHandle).to.be.equal(true, `Should be able to handle ${code}`);
                diagnostic.verifyAll();
            }
        }));
        test('Can not handle non-InvalidPythonPathInterpreter diagnostics', () => __awaiter(this, void 0, void 0, function* () {
            const diagnostic = typemoq.Mock.ofType();
            diagnostic.setup(d => d.code)
                .returns(() => 'Something Else')
                .verifiable(typemoq.Times.atLeastOnce());
            const canHandle = yield diagnosticService.canHandle(diagnostic.object);
            chai_1.expect(canHandle).to.be.equal(false, 'Invalid value');
            diagnostic.verifyAll();
        }));
        test('Should return empty diagnostics if installer check is disabled', () => __awaiter(this, void 0, void 0, function* () {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            const diagnostics = yield diagnosticService.diagnose();
            chai_1.expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
        }));
        test('Should return diagnostics if there are no interpreters', () => __awaiter(this, void 0, void 0, function* () {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([]))
                .verifiable(typemoq.Times.once());
            const diagnostics = yield diagnosticService.diagnose();
            chai_1.expect(diagnostics).to.be.deep.equal([new pythonInterpreter_1.InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.NoPythonInterpretersDiagnostic)]);
            settings.verifyAll();
            interpreterService.verifyAll();
        }));
        test('Should return empty diagnostics if there are interpreters and platform is not mac', () => __awaiter(this, void 0, void 0, function* () {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([{}]))
                .verifiable(typemoq.Times.once());
            platformService
                .setup(i => i.isMac)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            const diagnostics = yield diagnosticService.diagnose();
            chai_1.expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
        }));
        test('Should return empty diagnostics if there are interpreters, platform is mac and selected interpreter is not default mac interpreter', () => __awaiter(this, void 0, void 0, function* () {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([{}]))
                .verifiable(typemoq.Times.once());
            platformService
                .setup(i => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup(i => i.isMacDefaultPythonPath(typemoq.It.isAny()))
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            const diagnostics = yield diagnosticService.diagnose();
            chai_1.expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        }));
        test('Should return diagnostic if there are no other interpreters, platform is mac and selected interpreter is default mac interpreter', () => __awaiter(this, void 0, void 0, function* () {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([
                { path: pythonPath },
                { path: pythonPath }
            ]))
                .verifiable(typemoq.Times.once());
            platformService
                .setup(i => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup(i => i.isMacDefaultPythonPath(typemoq.It.isValue(pythonPath)))
                .returns(() => true)
                .verifiable(typemoq.Times.atLeastOnce());
            interpreterService
                .setup(i => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => { return Promise.resolve({ type: contracts_1.InterpreterType.Unknown }); })
                .verifiable(typemoq.Times.once());
            const diagnostics = yield diagnosticService.diagnose();
            chai_1.expect(diagnostics).to.be.deep.equal([new pythonInterpreter_1.InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic)]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        }));
        test('Should return diagnostic if there are other interpreters, platform is mac and selected interpreter is default mac interpreter', () => __awaiter(this, void 0, void 0, function* () {
            const nonMacStandardInterpreter = 'Non Mac Std Interpreter';
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([
                { path: pythonPath },
                { path: pythonPath },
                { path: nonMacStandardInterpreter }
            ]))
                .verifiable(typemoq.Times.once());
            platformService
                .setup(i => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup(i => i.isMacDefaultPythonPath(typemoq.It.isValue(pythonPath)))
                .returns(() => true)
                .verifiable(typemoq.Times.atLeastOnce());
            helper
                .setup(i => i.isMacDefaultPythonPath(typemoq.It.isValue(nonMacStandardInterpreter)))
                .returns(() => false)
                .verifiable(typemoq.Times.atLeastOnce());
            interpreterService
                .setup(i => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => { return Promise.resolve({ type: contracts_1.InterpreterType.Unknown }); })
                .verifiable(typemoq.Times.once());
            const diagnostics = yield diagnosticService.diagnose();
            chai_1.expect(diagnostics).to.be.deep.equal([new pythonInterpreter_1.InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic)]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        }));
        test('Handling no interpreters diagnostisc should return download link', () => __awaiter(this, void 0, void 0, function* () {
            const diagnostic = new pythonInterpreter_1.InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.NoPythonInterpretersDiagnostic);
            const cmd = {};
            let messagePrompt;
            messageHandler
                .setup(i => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((d, p) => messagePrompt = p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory.setup(f => f.createCommand(typemoq.It.isAny(), typemoq.It.isObjectWith({ type: 'launch' })))
                .returns(() => cmd)
                .verifiable(typemoq.Times.once());
            yield diagnosticService.handle([diagnostic]);
            messageHandler.verifyAll();
            commandFactory.verifyAll();
            chai_1.expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            chai_1.expect(messagePrompt.commandPrompts).to.be.deep.equal([{ prompt: 'Download', command: cmd }]);
        }));
        test('Handling no interpreters diagnostisc should return select interpreter cmd', () => __awaiter(this, void 0, void 0, function* () {
            const diagnostic = new pythonInterpreter_1.InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic);
            const cmd = {};
            let messagePrompt;
            messageHandler
                .setup(i => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((d, p) => messagePrompt = p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory.setup(f => f.createCommand(typemoq.It.isAny(), typemoq.It.isObjectWith({ type: 'executeVSCCommand' })))
                .returns(() => cmd)
                .verifiable(typemoq.Times.once());
            yield diagnosticService.handle([diagnostic]);
            messageHandler.verifyAll();
            commandFactory.verifyAll();
            chai_1.expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            chai_1.expect(messagePrompt.commandPrompts).to.be.deep.equal([{ prompt: 'Select Python Interpreter', command: cmd }]);
        }));
        test('Handling no interpreters diagnostisc should return download and learn links', () => __awaiter(this, void 0, void 0, function* () {
            const diagnostic = new pythonInterpreter_1.InvalidPythonInterpreterDiagnostic(constants_1.DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic);
            const cmdDownload = {};
            const cmdLearn = {};
            let messagePrompt;
            messageHandler
                .setup(i => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((d, p) => messagePrompt = p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory.setup(f => f.createCommand(typemoq.It.isAny(), typemoq.It.isObjectWith({ type: 'launch', options: 'https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites' })))
                .returns(() => cmdLearn)
                .verifiable(typemoq.Times.once());
            commandFactory.setup(f => f.createCommand(typemoq.It.isAny(), typemoq.It.isObjectWith({ type: 'launch', options: 'https://www.python.org/downloads' })))
                .returns(() => cmdDownload)
                .verifiable(typemoq.Times.once());
            yield diagnosticService.handle([diagnostic]);
            messageHandler.verifyAll();
            commandFactory.verifyAll();
            chai_1.expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            chai_1.expect(messagePrompt.commandPrompts).to.be.deep.equal([{ prompt: 'Learn more', command: cmdLearn }, { prompt: 'Download', command: cmdDownload }]);
        }));
    });
    suite('Change Handlers.', () => {
        test('Add PythonPath handler is invoked', () => __awaiter(this, void 0, void 0, function* () {
            let invoked = false;
            diagnosticService = new class extends pythonInterpreter_1.InvalidPythonInterpreterService {
                addPythonPathChangedHandler() { invoked = true; }
            }(createContainer());
            chai_1.expect(invoked).to.be.equal(true, 'Not invoked');
        }));
        test('Event Handler is registered and invoked', () => __awaiter(this, void 0, void 0, function* () {
            let invoked = false;
            let callbackHandler;
            const workspaceService = { onDidChangeConfiguration: cb => callbackHandler = cb };
            const serviceContainerObject = createContainer();
            serviceContainer.setup(s => s.get(typemoq.It.isValue(types_3.IWorkspaceService)))
                .returns(() => workspaceService);
            diagnosticService = new class extends pythonInterpreter_1.InvalidPythonInterpreterService {
                onDidChangeConfiguration(_event) {
                    return __awaiter(this, void 0, void 0, function* () { invoked = true; });
                }
            }(serviceContainerObject);
            yield callbackHandler({});
            chai_1.expect(invoked).to.be.equal(true, 'Not invoked');
        }));
        test('Event Handler is registered and not invoked', () => __awaiter(this, void 0, void 0, function* () {
            let invoked = false;
            const workspaceService = { onDidChangeConfiguration: misc_1.noop };
            const serviceContainerObject = createContainer();
            serviceContainer.setup(s => s.get(typemoq.It.isValue(types_3.IWorkspaceService)))
                .returns(() => workspaceService);
            diagnosticService = new class extends pythonInterpreter_1.InvalidPythonInterpreterService {
                onDidChangeConfiguration(_event) {
                    return __awaiter(this, void 0, void 0, function* () { invoked = true; });
                }
            }(serviceContainerObject);
            chai_1.expect(invoked).to.be.equal(false, 'Not invoked');
        }));
        test('Diagnostics are checked when path changes', () => __awaiter(this, void 0, void 0, function* () {
            const event = typemoq.Mock.ofType();
            const workspaceService = typemoq.Mock.ofType();
            const serviceContainerObject = createContainer();
            let diagnoseInvocationCount = 0;
            workspaceService
                .setup(w => w.hasWorkspaceFolders)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            workspaceService
                .setup(w => w.workspaceFolders)
                .returns(() => [{ uri: '' }])
                .verifiable(typemoq.Times.once());
            serviceContainer.setup(s => s.get(typemoq.It.isValue(types_3.IWorkspaceService)))
                .returns(() => workspaceService.object);
            const diagnosticSvc = new class extends pythonInterpreter_1.InvalidPythonInterpreterService {
                constructor(item) {
                    super(item);
                    this.onDidChangeConfigurationEx = e => super.onDidChangeConfiguration(e);
                    this.changeThrottleTimeout = 1;
                }
                diagnose() {
                    diagnoseInvocationCount += 1;
                    return Promise.resolve();
                }
            }(serviceContainerObject);
            event
                .setup(e => e.affectsConfiguration(typemoq.It.isValue('python.pythonPath'), typemoq.It.isAny()))
                .returns(() => true)
                .verifiable(typemoq.Times.atLeastOnce());
            yield diagnosticSvc.onDidChangeConfigurationEx(event.object);
            event.verifyAll();
            yield core_1.sleep(100);
            chai_1.expect(diagnoseInvocationCount).to.be.equal(1, 'Not invoked');
            yield diagnosticSvc.onDidChangeConfigurationEx(event.object);
            yield core_1.sleep(100);
            chai_1.expect(diagnoseInvocationCount).to.be.equal(2, 'Not invoked');
        }));
        test('Diagnostics are checked and throttled when path changes', () => __awaiter(this, void 0, void 0, function* () {
            const event = typemoq.Mock.ofType();
            const workspaceService = typemoq.Mock.ofType();
            const serviceContainerObject = createContainer();
            let diagnoseInvocationCount = 0;
            workspaceService
                .setup(w => w.hasWorkspaceFolders)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            workspaceService
                .setup(w => w.workspaceFolders)
                .returns(() => [{ uri: '' }])
                .verifiable(typemoq.Times.once());
            serviceContainer.setup(s => s.get(typemoq.It.isValue(types_3.IWorkspaceService)))
                .returns(() => workspaceService.object);
            const diagnosticSvc = new class extends pythonInterpreter_1.InvalidPythonInterpreterService {
                constructor(item) {
                    super(item);
                    this.onDidChangeConfigurationEx = e => super.onDidChangeConfiguration(e);
                    this.changeThrottleTimeout = 100;
                }
                diagnose() {
                    diagnoseInvocationCount += 1;
                    return Promise.resolve();
                }
            }(serviceContainerObject);
            event
                .setup(e => e.affectsConfiguration(typemoq.It.isValue('python.pythonPath'), typemoq.It.isAny()))
                .returns(() => true)
                .verifiable(typemoq.Times.atLeastOnce());
            yield diagnosticSvc.onDidChangeConfigurationEx(event.object);
            yield diagnosticSvc.onDidChangeConfigurationEx(event.object);
            yield diagnosticSvc.onDidChangeConfigurationEx(event.object);
            yield diagnosticSvc.onDidChangeConfigurationEx(event.object);
            yield diagnosticSvc.onDidChangeConfigurationEx(event.object);
            yield core_1.sleep(500);
            event.verifyAll();
            chai_1.expect(diagnoseInvocationCount).to.be.equal(1, 'Not invoked');
        }));
    });
});
//# sourceMappingURL=pythonInterpreter.unit.test.js.map