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
// tslint:disable:no-invalid-template-strings max-func-body-length
const chai_1 = require("chai");
const path = require("path");
const typemoq = require("typemoq");
const invalidPythonPathInDebugger_1 = require("../../../../client/application/diagnostics/checks/invalidPythonPathInDebugger");
const types_1 = require("../../../../client/application/diagnostics/commands/types");
const constants_1 = require("../../../../client/application/diagnostics/constants");
const promptHandler_1 = require("../../../../client/application/diagnostics/promptHandler");
const types_2 = require("../../../../client/application/diagnostics/types");
const types_3 = require("../../../../client/common/types");
const contracts_1 = require("../../../../client/interpreter/contracts");
suite('Application Diagnostics - Checks Python Path in debugger', () => {
    let diagnosticService;
    let messageHandler;
    let commandFactory;
    let configService;
    let helper;
    setup(() => {
        const serviceContainer = typemoq.Mock.ofType();
        messageHandler = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IDiagnosticHandlerService), typemoq.It.isValue(promptHandler_1.DiagnosticCommandPromptHandlerServiceId)))
            .returns(() => messageHandler.object);
        commandFactory = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_1.IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        configService = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_3.IConfigurationService)))
            .returns(() => configService.object);
        helper = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(contracts_1.IInterpreterHelper)))
            .returns(() => helper.object);
        diagnosticService = new invalidPythonPathInDebugger_1.InvalidPythonPathInDebuggerService(serviceContainer.object);
    });
    test('Can handle InvalidPythonPathInDebugger diagnostics', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        diagnostic.setup(d => d.code)
            .returns(() => constants_1.DiagnosticCodes.InvalidPythonPathInDebuggerDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        const canHandle = yield diagnosticService.canHandle(diagnostic.object);
        chai_1.expect(canHandle).to.be.equal(true, 'Invalid value');
        diagnostic.verifyAll();
    }));
    test('Can not handle non-InvalidPythonPathInDebugger diagnostics', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        diagnostic.setup(d => d.code)
            .returns(() => 'Something Else')
            .verifiable(typemoq.Times.atLeastOnce());
        const canHandle = yield diagnosticService.canHandle(diagnostic.object);
        chai_1.expect(canHandle).to.be.equal(false, 'Invalid value');
        diagnostic.verifyAll();
    }));
    test('Should return empty diagnostics', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostics = yield diagnosticService.diagnose();
        chai_1.expect(diagnostics).to.be.deep.equal([]);
    }));
    test('Should display one option to with a command', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        diagnostic.setup(d => d.code)
            .returns(() => constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        const interpreterSelectionCommand = typemoq.Mock.ofType();
        commandFactory.setup(f => f.createCommand(typemoq.It.isAny(), typemoq.It.isObjectWith({ type: 'executeVSCCommand' })))
            .returns(() => interpreterSelectionCommand.object)
            .verifiable(typemoq.Times.once());
        messageHandler.setup(m => m.handle(typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.once());
        yield diagnosticService.handle([diagnostic.object]);
        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
    }));
    test('Ensure we get python path from config when path = ${config:python.pythonPath}', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = '${config:python.pythonPath}';
        const settings = typemoq.Mock.ofType();
        settings
            .setup(s => s.pythonPath)
            .returns(() => 'p')
            .verifiable(typemoq.Times.once());
        configService
            .setup(c => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.once());
        helper
            .setup(h => h.getInterpreterInformation(typemoq.It.isValue('p')))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());
        const valid = yield diagnosticService.validatePythonPath(pythonPath);
        settings.verifyAll();
        configService.verifyAll();
        helper.verifyAll();
        chai_1.expect(valid).to.be.equal(true, 'not valid');
    }));
    test('Ensure we get python path from config when path = undefined', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = undefined;
        const settings = typemoq.Mock.ofType();
        settings
            .setup(s => s.pythonPath)
            .returns(() => 'p')
            .verifiable(typemoq.Times.once());
        configService
            .setup(c => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.once());
        helper
            .setup(h => h.getInterpreterInformation(typemoq.It.isValue('p')))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());
        const valid = yield diagnosticService.validatePythonPath(pythonPath);
        settings.verifyAll();
        configService.verifyAll();
        helper.verifyAll();
        chai_1.expect(valid).to.be.equal(true, 'not valid');
    }));
    test('Ensure we do get python path from config when path is provided', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b');
        const settings = typemoq.Mock.ofType();
        configService
            .setup(c => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.never());
        helper
            .setup(h => h.getInterpreterInformation(typemoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());
        const valid = yield diagnosticService.validatePythonPath(pythonPath);
        configService.verifyAll();
        helper.verifyAll();
        chai_1.expect(valid).to.be.equal(true, 'not valid');
    }));
    test('Ensure diagnosics are handled when path is invalid', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b');
        let handleInvoked = false;
        diagnosticService.handle = () => { handleInvoked = true; return Promise.resolve(); };
        helper
            .setup(h => h.getInterpreterInformation(typemoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());
        const valid = yield diagnosticService.validatePythonPath(pythonPath);
        helper.verifyAll();
        chai_1.expect(valid).to.be.equal(false, 'should be invalid');
        chai_1.expect(handleInvoked).to.be.equal(true, 'should be invoked');
    }));
});
//# sourceMappingURL=invalidPythonPathInDebugger.unit.test.js.map