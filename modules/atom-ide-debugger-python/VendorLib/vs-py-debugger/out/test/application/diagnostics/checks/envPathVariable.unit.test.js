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
const path = require("path");
const typemoq = require("typemoq");
const vscode_1 = require("vscode");
const envPathVariable_1 = require("../../../../client/application/diagnostics/checks/envPathVariable");
const types_1 = require("../../../../client/application/diagnostics/commands/types");
const constants_1 = require("../../../../client/application/diagnostics/constants");
const promptHandler_1 = require("../../../../client/application/diagnostics/promptHandler");
const types_2 = require("../../../../client/application/diagnostics/types");
const types_3 = require("../../../../client/common/application/types");
const types_4 = require("../../../../client/common/platform/types");
const types_5 = require("../../../../client/common/types");
// tslint:disable-next-line:max-func-body-length
suite('Application Diagnostics - Checks Env Path Variable', () => {
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
        diagnosticService = new envPathVariable_1.EnvironmentPathVariableDiagnosticsService(serviceContainer.object);
    });
    test('Can handle EnvPathVariable diagnostics', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostic = typemoq.Mock.ofType();
        diagnostic.setup(d => d.code)
            .returns(() => constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic)
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
    test('Should return empty diagnostics for Mac', () => __awaiter(this, void 0, void 0, function* () {
        platformService.setup(p => p.isMac).returns(() => true);
        platformService.setup(p => p.isLinux).returns(() => false);
        platformService.setup(p => p.isWindows).returns(() => false);
        const diagnostics = yield diagnosticService.diagnose();
        chai_1.expect(diagnostics).to.be.deep.equal([]);
    }));
    test('Should return empty diagnostics for Linux', () => __awaiter(this, void 0, void 0, function* () {
        platformService.setup(p => p.isMac).returns(() => false);
        platformService.setup(p => p.isLinux).returns(() => true);
        platformService.setup(p => p.isWindows).returns(() => false);
        const diagnostics = yield diagnosticService.diagnose();
        chai_1.expect(diagnostics).to.be.deep.equal([]);
    }));
    test('Should return empty diagnostics for Windows if path variable is valid', () => __awaiter(this, void 0, void 0, function* () {
        platformService.setup(p => p.isWindows).returns(() => true);
        const paths = [
            path.join('one', 'two', 'three'),
            path.join('one', 'two', 'four')
        ].join(pathDelimiter);
        procEnv.setup(env => env[pathVariableName]).returns(() => paths);
        const diagnostics = yield diagnosticService.diagnose();
        chai_1.expect(diagnostics).to.be.deep.equal([]);
    }));
    // Note: On windows, when a path contains a `;` then Windows encloses the path within `"`.
    test('Should return single diagnostics for Windows if path contains \'"\'', () => __awaiter(this, void 0, void 0, function* () {
        platformService.setup(p => p.isWindows).returns(() => true);
        const paths = [
            path.join('one', 'two', 'three"'),
            path.join('one', 'two', 'four')
        ].join(pathDelimiter);
        procEnv.setup(env => env[pathVariableName]).returns(() => paths);
        const diagnostics = yield diagnosticService.diagnose();
        chai_1.expect(diagnostics).to.be.lengthOf(1);
        chai_1.expect(diagnostics[0].code).to.be.equal(constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic);
        chai_1.expect(diagnostics[0].message).to.contain(extensionName);
        chai_1.expect(diagnostics[0].message).to.contain(pathVariableName);
        chai_1.expect(diagnostics[0].severity).to.be.equal(vscode_1.DiagnosticSeverity.Warning);
        chai_1.expect(diagnostics[0].scope).to.be.equal(types_2.DiagnosticScope.Global);
    }));
    test('Should not return diagnostics for Windows if path ends with delimiter', () => __awaiter(this, void 0, void 0, function* () {
        const paths = [
            path.join('one', 'two', 'three'),
            path.join('one', 'two', 'four')
        ].join(pathDelimiter) + pathDelimiter;
        platformService.setup(p => p.isWindows).returns(() => true);
        procEnv.setup(env => env[pathVariableName]).returns(() => paths);
        const diagnostics = yield diagnosticService.diagnose();
        chai_1.expect(diagnostics).to.be.lengthOf(0);
    }));
    test('Should display three options in message displayed with 2 commands', () => __awaiter(this, void 0, void 0, function* () {
        platformService.setup(p => p.isWindows).returns(() => true);
        const diagnostic = typemoq.Mock.ofType();
        diagnostic.setup(d => d.code)
            .returns(() => constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic)
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
            .verifiable(typemoq.Times.once());
        yield diagnosticService.handle([diagnostic.object]);
        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
    }));
    test('Should not display a message if the diagnostic code has been ignored', () => __awaiter(this, void 0, void 0, function* () {
        platformService.setup(p => p.isWindows).returns(() => true);
        const diagnostic = typemoq.Mock.ofType();
        filterService.setup(f => f.shouldIgnoreDiagnostic(typemoq.It.isValue(constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic)))
            .returns(() => Promise.resolve(true))
            .verifiable(typemoq.Times.once());
        diagnostic.setup(d => d.code)
            .returns(() => constants_1.DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        commandFactory.setup(f => f.createCommand(typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.never());
        messageHandler.setup(m => m.handle(typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.never());
        yield diagnosticService.handle([diagnostic.object]);
        filterService.verifyAll();
        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
    }));
});
//# sourceMappingURL=envPathVariable.unit.test.js.map