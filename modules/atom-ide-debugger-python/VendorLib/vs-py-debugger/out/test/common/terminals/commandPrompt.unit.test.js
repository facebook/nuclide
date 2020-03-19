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
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const commandPrompt_1 = require("../../../client/common/terminal/commandPrompt");
suite('Terminal Command Prompt', () => {
    let currentProc;
    let configService;
    setup(() => {
        currentProc = TypeMoq.Mock.ofType();
        configService = TypeMoq.Mock.ofType();
    });
    test('Getting Path Command Prompt executable (32 on 64Win)', () => __awaiter(this, void 0, void 0, function* () {
        const env = { windir: 'windir' };
        currentProc.setup(p => p.env)
            .returns(() => env)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const cmdPath = commandPrompt_1.getCommandPromptLocation(currentProc.object);
        chai_1.expect(cmdPath).to.be.deep.equal(path.join('windir', 'System32', 'cmd.exe'));
        currentProc.verifyAll();
    }));
    test('Getting Path Command Prompt executable (not 32 on 64Win)', () => __awaiter(this, void 0, void 0, function* () {
        const env = { PROCESSOR_ARCHITEW6432: 'x', windir: 'windir' };
        currentProc.setup(p => p.env)
            .returns(() => env)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const cmdPath = commandPrompt_1.getCommandPromptLocation(currentProc.object);
        chai_1.expect(cmdPath).to.be.deep.equal(path.join('windir', 'Sysnative', 'cmd.exe'));
        currentProc.verifyAll();
    }));
    test('Use command prompt as default shell', () => __awaiter(this, void 0, void 0, function* () {
        const env = { windir: 'windir' };
        currentProc.setup(p => p.env)
            .returns(() => env)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const cmdPromptPath = path.join('windir', 'System32', 'cmd.exe');
        configService
            .setup(c => c.updateSectionSetting(TypeMoq.It.isValue('terminal'), TypeMoq.It.isValue('integrated.shell.windows'), TypeMoq.It.isValue(cmdPromptPath), TypeMoq.It.isAny(), TypeMoq.It.isValue(vscode_1.ConfigurationTarget.Global)))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        yield commandPrompt_1.useCommandPromptAsDefaultShell(currentProc.object, configService.object);
        configService.verifyAll();
        currentProc.verifyAll();
    }));
});
//# sourceMappingURL=commandPrompt.unit.test.js.map