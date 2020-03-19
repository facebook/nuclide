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
const TypeMoq = require("typemoq");
require("../../../client/common/extensions");
const pyenvActivationProvider_1 = require("../../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider");
const types_1 = require("../../../client/common/terminal/types");
const enum_1 = require("../../../client/common/utils/enum");
const platform_1 = require("../../../client/common/utils/platform");
const contracts_1 = require("../../../client/interpreter/contracts");
suite('Terminal Environment Activation pyenv', () => {
    let serviceContainer;
    let interpreterService;
    let activationProvider;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        interpreterService = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IInterpreterService), TypeMoq.It.isAny())).returns(() => interpreterService.object);
        activationProvider = new pyenvActivationProvider_1.PyEnvActivationCommandProvider(serviceContainer.object);
    });
    test('All shells should be supported', () => __awaiter(this, void 0, void 0, function* () {
        for (const item of enum_1.getNamesAndValues(types_1.TerminalShellType)) {
            chai_1.expect(activationProvider.isShellSupported(item.value)).to.equal(true, 'All shells should be supported');
        }
    }));
    test('Ensure no activation commands are returned if intrepreter info is not found', () => __awaiter(this, void 0, void 0, function* () {
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        const activationCommands = yield activationProvider.getActivationCommands(undefined, types_1.TerminalShellType.bash);
        chai_1.expect(activationCommands).to.equal(undefined, 'Activation commands should be undefined');
    }));
    test('Ensure no activation commands are returned if intrepreter is not pyenv', () => __awaiter(this, void 0, void 0, function* () {
        const intepreterInfo = {
            architecture: platform_1.Architecture.Unknown,
            path: '',
            sysPrefix: '',
            version: '',
            version_info: [1, 1, 1, 'alpha'],
            sysVersion: '',
            type: contracts_1.InterpreterType.Unknown
        };
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(intepreterInfo))
            .verifiable(TypeMoq.Times.once());
        const activationCommands = yield activationProvider.getActivationCommands(undefined, types_1.TerminalShellType.bash);
        chai_1.expect(activationCommands).to.equal(undefined, 'Activation commands should be undefined');
    }));
    test('Ensure no activation commands are returned if intrepreter envName is empty', () => __awaiter(this, void 0, void 0, function* () {
        const intepreterInfo = {
            architecture: platform_1.Architecture.Unknown,
            path: '',
            sysPrefix: '',
            version: '',
            version_info: [1, 1, 1, 'alpha'],
            sysVersion: '',
            type: contracts_1.InterpreterType.Pyenv
        };
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(intepreterInfo))
            .verifiable(TypeMoq.Times.once());
        const activationCommands = yield activationProvider.getActivationCommands(undefined, types_1.TerminalShellType.bash);
        chai_1.expect(activationCommands).to.equal(undefined, 'Activation commands should be undefined');
    }));
    test('Ensure activation command is returned', () => __awaiter(this, void 0, void 0, function* () {
        const intepreterInfo = {
            architecture: platform_1.Architecture.Unknown,
            path: '',
            sysPrefix: '',
            version: '',
            version_info: [1, 1, 1, 'alpha'],
            sysVersion: '',
            type: contracts_1.InterpreterType.Pyenv,
            envName: 'my env name'
        };
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(intepreterInfo))
            .verifiable(TypeMoq.Times.once());
        const activationCommands = yield activationProvider.getActivationCommands(undefined, types_1.TerminalShellType.bash);
        chai_1.expect(activationCommands).to.deep.equal([`pyenv shell ${intepreterInfo.envName}`], 'Invalid Activation command');
    }));
});
//# sourceMappingURL=pyenvActivationProvider.unit.test.js.map