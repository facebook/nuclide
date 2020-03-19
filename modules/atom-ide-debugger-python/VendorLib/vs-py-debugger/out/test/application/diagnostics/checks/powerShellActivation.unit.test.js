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
const chai_1 = require("chai");
const typemoq = require("typemoq");
const powerShellActivation_1 = require("../../../../client/application/diagnostics/checks/powerShellActivation");
const types_1 = require("../../../../client/application/diagnostics/commands/types");
const constants_1 = require("../../../../client/application/diagnostics/constants");
const promptHandler_1 = require("../../../../client/application/diagnostics/promptHandler");
const types_2 = require("../../../../client/application/diagnostics/types");
const types_3 = require("../../../../client/common/application/types");
const types_4 = require("../../../../client/common/platform/types");
const types_5 = require("../../../../client/common/types");
// tslint:disable-next-line:max-func-body-length
suite('Application Diagnostics - PowerShell Activation', () => {
    let diagnosticService;
    let platformService;
    let messageHandler;
    let filterService;
    let procEnv;
    let appEnv;
    let commandFactory;
    const pathVariableName = 'Path';
    const pathDelimiter = ';';
    const extensionName = 'Some Extension Name';
    setup(() => {
        const serviceContainer = typemoq.Mock.ofType();
        platformService = typemoq.Mock.ofType();
        platformService.setup(p => p.pathVariableName).returns(() => pathVariableName);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_4.IPlatformService)))
            .returns(() => platformService.object);
        messageHandler = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IDiagnosticHandlerService), typemoq.It.isValue(promptHandler_1.DiagnosticCommandPromptHandlerServiceId)))
            .returns(() => messageHandler.object);
        appEnv = typemoq.Mock.ofType();
        appEnv.setup(a => a.extensionName).returns(() => extensionName);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_3.IApplicationEnvironment)))
            .returns(() => appEnv.object);
        filterService = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IDiagnosticFilterService)))
            .returns(() => filterService.object);
        commandFactory = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_1.IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        const currentProc = typemoq.Mock.ofType();
        procEnv = typemoq.Mock.ofType();
        currentProc.setup(p => p.env).returns(() => procEnv.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_5.ICurrentProcess)))
            .returns(() => currentProc.object);
        const pathUtils = typemoq.Mock.ofType();
        pathUtils.setup(p => p.delimiter).returns(() => pathDelimiter);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_5.IPathUtils)))
            .returns(() => pathUtils.object);
        diagnosticService = new powerShellActivation_1.PowerShellActivationHackDiagnosticsService(serviceContainer.object);
    });
    test('Can handle PowerShell diagnostics', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        diagnostic.setup(d => d.code)
            .returns(() => constants_1.DiagnosticCodes.EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        const canHandle = yield diagnosticService.canHandle(diagnostic.object);
        chai_1.expect(canHandle).to.be.equal(true, 'Invalid value');
        diagnostic.verifyAll();
    }));
    test('Can not handle non-EnvPathVariable diagnostics', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        diagnostic.setup(d => d.code)
            .returns(() => 'Something Else')
            .verifiable(typemoq.Times.atLeastOnce());
        const canHandle = yield diagnosticService.canHandle(diagnostic.object);
        chai_1.expect(canHandle).to.be.equal(false, 'Invalid value');
        diagnostic.verifyAll();
    }));
    test('Must return empty diagnostics', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostics = yield diagnosticService.diagnose();
        chai_1.expect(diagnostics).to.be.deep.equal([]);
    }));
    test('Should display three options in message displayed with 4 commands', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        let options;
        diagnostic.setup(d => d.code)
            .returns(() => constants_1.DiagnosticCodes.EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        const alwaysIgnoreCommand = typemoq.Mock.ofType();
        commandFactory.setup(f => f.createCommand(typemoq.It.isAny(), typemoq.It.isObjectWith({ type: 'ignore', options: types_2.DiagnosticScope.Global })))
            .returns(() => alwaysIgnoreCommand.object)
            .verifiable(typemoq.Times.once());
        const launchBrowserCommand = typemoq.Mock.ofType();
        commandFactory.setup(f => f.createCommand(typemoq.It.isAny(), typemoq.It.isObjectWith({ type: 'launch' })))
            .returns(() => launchBrowserCommand.object)
            .verifiable(typemoq.Times.once());
        messageHandler.setup(m => m.handle(typemoq.It.isAny(), typemoq.It.isAny()))
            .callback((_, opts) => options = opts)
            .verifiable(typemoq.Times.once());
        yield diagnosticService.handle([diagnostic.object]);
        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
        chai_1.expect(options.commandPrompts).to.be.lengthOf(4);
        chai_1.expect(options.commandPrompts[0].prompt).to.be.equal('Use Command Prompt');
    }));
});
//# sourceMappingURL=powerShellActivation.unit.test.js.map