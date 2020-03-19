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
const types_1 = require("../../../client/common/application/types");
const types_2 = require("../../../client/common/terminal/types");
const types_3 = require("../../../client/common/types");
const misc_1 = require("../../../client/common/utils/misc");
const activation_1 = require("../../../client/terminals/activation");
suite('Terminal Auto Activation', () => {
    let activator;
    let terminalManager;
    let terminalAutoActivation;
    setup(() => {
        terminalManager = TypeMoq.Mock.ofType();
        activator = TypeMoq.Mock.ofType();
        const disposables = [];
        const serviceContainer = TypeMoq.Mock.ofType();
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(types_1.ITerminalManager), TypeMoq.It.isAny()))
            .returns(() => terminalManager.object);
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(types_2.ITerminalHelper), TypeMoq.It.isAny()))
            .returns(() => activator.object);
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(types_3.IDisposableRegistry), TypeMoq.It.isAny()))
            .returns(() => disposables);
        terminalAutoActivation = new activation_1.TerminalAutoActivation(serviceContainer.object, activator.object);
    });
    test('New Terminals should be activated', () => __awaiter(this, void 0, void 0, function* () {
        let eventHandler;
        const terminal = TypeMoq.Mock.ofType();
        terminalManager
            .setup(m => m.onDidOpenTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(handler => {
            eventHandler = handler;
            return { dispose: misc_1.noop };
        });
        activator
            .setup(h => h.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .verifiable(TypeMoq.Times.once());
        terminalAutoActivation.register();
        chai_1.expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');
        eventHandler.bind(terminalAutoActivation)(terminal.object);
        activator.verifyAll();
    }));
});
//# sourceMappingURL=activation.unit.test.js.map