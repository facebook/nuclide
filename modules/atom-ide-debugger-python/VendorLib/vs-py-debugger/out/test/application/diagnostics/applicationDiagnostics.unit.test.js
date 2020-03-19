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
// tslint:disable:insecure-random
const typemoq = require("typemoq");
const vscode_1 = require("vscode");
const applicationDiagnostics_1 = require("../../../client/application/diagnostics/applicationDiagnostics");
const envPathVariable_1 = require("../../../client/application/diagnostics/checks/envPathVariable");
const invalidDebuggerType_1 = require("../../../client/application/diagnostics/checks/invalidDebuggerType");
const types_1 = require("../../../client/application/diagnostics/types");
const constants_1 = require("../../../client/common/constants");
const types_2 = require("../../../client/common/types");
// tslint:disable-next-line:max-func-body-length
suite('Application Diagnostics - ApplicationDiagnostics', () => {
    let serviceContainer;
    let envHealthCheck;
    let debuggerTypeCheck;
    let outputChannel;
    let logger;
    let appDiagnostics;
    setup(() => {
        serviceContainer = typemoq.Mock.ofType();
        envHealthCheck = typemoq.Mock.ofType();
        debuggerTypeCheck = typemoq.Mock.ofType();
        outputChannel = typemoq.Mock.ofType();
        logger = typemoq.Mock.ofType();
        serviceContainer.setup(d => d.get(typemoq.It.isValue(types_1.IDiagnosticsService), typemoq.It.isValue(envPathVariable_1.EnvironmentPathVariableDiagnosticsServiceId)))
            .returns(() => envHealthCheck.object);
        serviceContainer.setup(d => d.get(typemoq.It.isValue(types_1.IDiagnosticsService), typemoq.It.isValue(invalidDebuggerType_1.InvalidDebuggerTypeDiagnosticsServiceId)))
            .returns(() => debuggerTypeCheck.object);
        serviceContainer.setup(d => d.getAll(typemoq.It.isValue(types_1.IDiagnosticsService)))
            .returns(() => [envHealthCheck.object, debuggerTypeCheck.object]);
        serviceContainer.setup(d => d.get(typemoq.It.isValue(types_2.IOutputChannel), typemoq.It.isValue(constants_1.STANDARD_OUTPUT_CHANNEL)))
            .returns(() => outputChannel.object);
        serviceContainer.setup(d => d.get(typemoq.It.isValue(types_2.ILogger)))
            .returns(() => logger.object);
        appDiagnostics = new applicationDiagnostics_1.ApplicationDiagnostics(serviceContainer.object);
    });
    test('Performing Pre Startup Health Check must check Path environment variable and Debugger Type', () => __awaiter(this, void 0, void 0, function* () {
        envHealthCheck.setup(e => e.diagnose())
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());
        debuggerTypeCheck.setup(e => e.diagnose())
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());
        yield appDiagnostics.performPreStartupHealthCheck();
        envHealthCheck.verifyAll();
        debuggerTypeCheck.verifyAll();
    }));
    test('Diagnostics Returned by Per Startup Health Checks must be logged', () => __awaiter(this, void 0, void 0, function* () {
        const diagnostics = [];
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic = {
                code: `Error${i}`,
                message: `Error${i}`,
                scope: i % 2 === 0 ? types_1.DiagnosticScope.Global : types_1.DiagnosticScope.WorkspaceFolder,
                severity: vscode_1.DiagnosticSeverity.Error
            };
            diagnostics.push(diagnostic);
        }
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic = {
                code: `Warning${i}`,
                message: `Warning${i}`,
                scope: i % 2 === 0 ? types_1.DiagnosticScope.Global : types_1.DiagnosticScope.WorkspaceFolder,
                severity: vscode_1.DiagnosticSeverity.Warning
            };
            diagnostics.push(diagnostic);
        }
        for (let i = 0; i <= (Math.random() * 10); i += 1) {
            const diagnostic = {
                code: `Info${i}`,
                message: `Info${i}`,
                scope: i % 2 === 0 ? types_1.DiagnosticScope.Global : types_1.DiagnosticScope.WorkspaceFolder,
                severity: vscode_1.DiagnosticSeverity.Information
            };
            diagnostics.push(diagnostic);
        }
        for (const diagnostic of diagnostics) {
            const message = `Diagnostic Code: ${diagnostic.code}, Message: ${diagnostic.message}`;
            switch (diagnostic.severity) {
                case vscode_1.DiagnosticSeverity.Error: {
                    logger.setup(l => l.logError(message))
                        .verifiable(typemoq.Times.once());
                    outputChannel.setup(o => o.appendLine(message))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                case vscode_1.DiagnosticSeverity.Warning: {
                    logger.setup(l => l.logWarning(message))
                        .verifiable(typemoq.Times.once());
                    outputChannel.setup(o => o.appendLine(message))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                default: {
                    logger.setup(l => l.logInformation(message))
                        .verifiable(typemoq.Times.once());
                    break;
                }
            }
        }
        envHealthCheck.setup(e => e.diagnose())
            .returns(() => Promise.resolve(diagnostics))
            .verifiable(typemoq.Times.once());
        debuggerTypeCheck.setup(e => e.diagnose())
            .returns(() => Promise.resolve([]))
            .verifiable(typemoq.Times.once());
        yield appDiagnostics.performPreStartupHealthCheck();
        envHealthCheck.verifyAll();
        debuggerTypeCheck.verifyAll();
        outputChannel.verifyAll();
        logger.verifyAll();
    }));
});
//# sourceMappingURL=applicationDiagnostics.unit.test.js.map