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
const TypeMoq = require("typemoq");
const powershellFailedHandler_1 = require("../../../../client/common/terminal/activator/powershellFailedHandler");
const types_1 = require("../../../../client/common/terminal/types");
const enum_1 = require("../../../../client/common/utils/enum");
// tslint:disable-next-line:max-func-body-length
suite('Terminal Activation Powershell Failed Handler', () => {
    let psHandler;
    let helper;
    let platform;
    let diagnosticService;
    function testDiagnostics(mustHandleDiagnostics, isWindows, activatedSuccessfully, shellType, cmdPromptHasActivationCommands) {
        return __awaiter(this, void 0, void 0, function* () {
            platform.setup(p => p.isWindows).returns(() => isWindows);
            helper
                .setup(p => p.getTerminalShellPath())
                .returns(() => '');
            // .verifiable(TypeMoq.Times.atMostOnce());
            helper
                .setup(p => p.identifyTerminalShell(TypeMoq.It.isAny()))
                .returns(() => shellType);
            // .verifiable(TypeMoq.Times.atMostOnce());c
            const cmdPromptCommands = cmdPromptHasActivationCommands ? ['a'] : [];
            helper.setup(h => h.getEnvironmentActivationCommands(TypeMoq.It.isValue(types_1.TerminalShellType.commandPrompt), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(cmdPromptCommands));
            // .verifiable(TypeMoq.Times.atMostOnce());
            diagnosticService
                .setup(d => d.handle(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.exactly(mustHandleDiagnostics ? 1 : 0));
            yield psHandler.handleActivation(TypeMoq.Mock.ofType().object, undefined, false, activatedSuccessfully);
        });
    }
    [true, false].forEach(isWindows => {
        suite(`OS is ${isWindows ? 'Windows' : 'Non-Widows'}`, () => {
            enum_1.getNamesAndValues(types_1.TerminalShellType).forEach(shell => {
                suite(`Shell is ${shell.name}`, () => {
                    [true, false].forEach(hasCommandPromptActivations => {
                        hasCommandPromptActivations = isWindows && hasCommandPromptActivations && shell.value !== types_1.TerminalShellType.commandPrompt;
                        suite(`${hasCommandPromptActivations ? 'Can activate with Command Prompt' : 'Can\'t activate with Command Prompt'}`, () => {
                            [true, false].forEach(activatedSuccessfully => {
                                suite(`Terminal Activation is ${activatedSuccessfully ? 'successful' : 'has failed'}`, () => {
                                    setup(() => {
                                        helper = TypeMoq.Mock.ofType();
                                        platform = TypeMoq.Mock.ofType();
                                        diagnosticService = TypeMoq.Mock.ofType();
                                        psHandler = new powershellFailedHandler_1.PowershellTerminalActivationFailedHandler(helper.object, platform.object, diagnosticService.object);
                                    });
                                    const isPs = shell.value === types_1.TerminalShellType.powershell || shell.value === types_1.TerminalShellType.powershellCore;
                                    const mustHandleDiagnostics = isPs && !activatedSuccessfully && hasCommandPromptActivations;
                                    test(`Diagnostic must ${mustHandleDiagnostics ? 'be' : 'not be'} handled`, () => __awaiter(this, void 0, void 0, function* () {
                                        yield testDiagnostics(mustHandleDiagnostics, isWindows, activatedSuccessfully, shell.value, hasCommandPromptActivations);
                                        helper.verifyAll();
                                        diagnosticService.verifyAll();
                                    }));
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
//# sourceMappingURL=powerShellFailedHandler.unit.test.js.map