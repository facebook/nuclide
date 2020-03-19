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
// tslint:disable:insecure-random max-func-body-length
const typemoq = require("typemoq");
const vscode_1 = require("vscode");
const promptHandler_1 = require("../../../client/application/diagnostics/promptHandler");
const types_1 = require("../../../client/application/diagnostics/types");
const types_2 = require("../../../client/common/application/types");
const enum_1 = require("../../../client/common/utils/enum");
suite('Application Diagnostics - PromptHandler', () => {
    let serviceContainer;
    let appShell;
    let promptHandler;
    setup(() => {
        serviceContainer = typemoq.Mock.ofType();
        appShell = typemoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IApplicationShell)))
            .returns(() => appShell.object);
        promptHandler = new promptHandler_1.DiagnosticCommandPromptHandlerService(serviceContainer.object);
    });
    enum_1.getNamesAndValues(vscode_1.DiagnosticSeverity).forEach(severity => {
        test(`Handling a diagnositic of severity '${severity.name}' should display a message without any buttons`, () => __awaiter(this, void 0, void 0, function* () {
            const diagnostic = { code: '1', message: 'one', scope: types_1.DiagnosticScope.Global, severity: severity.value };
            switch (severity.value) {
                case vscode_1.DiagnosticSeverity.Error: {
                    appShell.setup(a => a.showErrorMessage(typemoq.It.isValue(diagnostic.message)))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                case vscode_1.DiagnosticSeverity.Warning: {
                    appShell.setup(a => a.showWarningMessage(typemoq.It.isValue(diagnostic.message)))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                default: {
                    appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(diagnostic.message)))
                        .verifiable(typemoq.Times.once());
                    break;
                }
            }
            yield promptHandler.handle(diagnostic);
            appShell.verifyAll();
        }));
        test(`Handling a diagnositic of severity '${severity.name}' should display a custom message with buttons`, () => __awaiter(this, void 0, void 0, function* () {
            const diagnostic = { code: '1', message: 'one', scope: types_1.DiagnosticScope.Global, severity: severity.value };
            const options = {
                commandPrompts: [
                    { prompt: 'Yes' },
                    { prompt: 'No' }
                ],
                message: 'Custom Message'
            };
            switch (severity.value) {
                case vscode_1.DiagnosticSeverity.Error: {
                    appShell.setup(a => a.showErrorMessage(typemoq.It.isValue(options.message), typemoq.It.isValue('Yes'), typemoq.It.isValue('No')))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                case vscode_1.DiagnosticSeverity.Warning: {
                    appShell.setup(a => a.showWarningMessage(typemoq.It.isValue(options.message), typemoq.It.isValue('Yes'), typemoq.It.isValue('No')))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                default: {
                    appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(options.message), typemoq.It.isValue('Yes'), typemoq.It.isValue('No')))
                        .verifiable(typemoq.Times.once());
                    break;
                }
            }
            yield promptHandler.handle(diagnostic, options);
            appShell.verifyAll();
        }));
        test(`Handling a diagnositic of severity '${severity.name}' should display a custom message with buttons and invoke selected command`, () => __awaiter(this, void 0, void 0, function* () {
            const diagnostic = { code: '1', message: 'one', scope: types_1.DiagnosticScope.Global, severity: severity.value };
            const command = typemoq.Mock.ofType();
            const options = {
                commandPrompts: [
                    { prompt: 'Yes', command: command.object },
                    { prompt: 'No', command: command.object }
                ],
                message: 'Custom Message'
            };
            command.setup(c => c.invoke())
                .verifiable(typemoq.Times.once());
            switch (severity.value) {
                case vscode_1.DiagnosticSeverity.Error: {
                    appShell.setup(a => a.showErrorMessage(typemoq.It.isValue(options.message), typemoq.It.isValue('Yes'), typemoq.It.isValue('No')))
                        .returns(() => Promise.resolve('Yes'))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                case vscode_1.DiagnosticSeverity.Warning: {
                    appShell.setup(a => a.showWarningMessage(typemoq.It.isValue(options.message), typemoq.It.isValue('Yes'), typemoq.It.isValue('No')))
                        .returns(() => Promise.resolve('Yes'))
                        .verifiable(typemoq.Times.once());
                    break;
                }
                default: {
                    appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(options.message), typemoq.It.isValue('Yes'), typemoq.It.isValue('No')))
                        .returns(() => Promise.resolve('Yes'))
                        .verifiable(typemoq.Times.once());
                    break;
                }
            }
            yield promptHandler.handle(diagnostic, options);
            appShell.verifyAll();
            command.verifyAll();
        }));
    });
});
//# sourceMappingURL=promptHandler.unit.test.js.map