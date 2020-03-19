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
const activator_1 = require("../../../../client/common/terminal/activator");
// tslint:disable-next-line:max-func-body-length
suite('Terminal Activator', () => {
    let activator;
    let baseActivator;
    let handler1;
    let handler2;
    setup(() => {
        baseActivator = TypeMoq.Mock.ofType();
        handler1 = TypeMoq.Mock.ofType();
        handler2 = TypeMoq.Mock.ofType();
        activator = new class extends activator_1.TerminalActivator {
            initialize() {
                this.baseActivator = baseActivator.object;
            }
        }(TypeMoq.Mock.ofType().object, [handler1.object, handler2.object]);
    });
    function testActivationAndHandlers(activationSuccessful) {
        return __awaiter(this, void 0, void 0, function* () {
            baseActivator
                .setup(b => b.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(activationSuccessful))
                .verifiable(TypeMoq.Times.once());
            handler1.setup(h => h.handleActivation(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isValue(activationSuccessful)))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            handler2.setup(h => h.handleActivation(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isValue(activationSuccessful)))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            const terminal = TypeMoq.Mock.ofType();
            yield activator.activateEnvironmentInTerminal(terminal.object, undefined, activationSuccessful);
            baseActivator.verifyAll();
            handler1.verifyAll();
            handler2.verifyAll();
        });
    }
    test('Terminal is activated and handlers are invoked', () => testActivationAndHandlers(true));
    test('Terminal is not activated and handlers are invoked', () => testActivationAndHandlers(false));
});
//# sourceMappingURL=index.unit.test.js.map