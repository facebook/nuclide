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
const chai_1 = require("chai");
const base_1 = require("../../../../client/common/terminal/activator/base");
const misc_1 = require("../../../../client/common/utils/misc");
// tslint:disable:max-func-body-length no-any
suite('Terminal Base Activator', () => {
    let activator;
    let helper;
    setup(() => {
        helper = TypeMoq.Mock.ofType();
        activator = new class extends base_1.BaseTerminalActivator {
            waitForCommandToProcess() { misc_1.noop(); return Promise.resolve(); }
        }(helper.object);
    });
    [
        { commandCount: 1, preserveFocus: false },
        { commandCount: 2, preserveFocus: false },
        { commandCount: 1, preserveFocus: true },
        { commandCount: 1, preserveFocus: true }
    ].forEach(item => {
        const titleSuffix = `(${item.commandCount} activation command, and preserve focus in terminal is ${item.preserveFocus})`;
        const activationCommands = item.commandCount === 1 ? ['CMD1'] : ['CMD1', 'CMD2'];
        test(`Terminal is activated ${titleSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            helper.setup(h => h.getTerminalShellPath()).returns(() => '');
            helper.setup(h => h.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(activationCommands));
            const terminal = TypeMoq.Mock.ofType();
            terminal
                .setup(t => t.show(TypeMoq.It.isValue(item.preserveFocus)))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.exactly(activationCommands.length));
            activationCommands.forEach(cmd => {
                terminal
                    .setup(t => t.sendText(TypeMoq.It.isValue(cmd)))
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.exactly(1));
            });
            yield activator.activateEnvironmentInTerminal(terminal.object, undefined, item.preserveFocus);
            terminal.verifyAll();
        }));
        test(`Terminal is activated only once ${titleSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            helper.setup(h => h.getTerminalShellPath()).returns(() => '');
            helper.setup(h => h.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(activationCommands));
            const terminal = TypeMoq.Mock.ofType();
            terminal
                .setup(t => t.show(TypeMoq.It.isValue(item.preserveFocus)))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.exactly(activationCommands.length));
            activationCommands.forEach(cmd => {
                terminal
                    .setup(t => t.sendText(TypeMoq.It.isValue(cmd)))
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.exactly(1));
            });
            yield activator.activateEnvironmentInTerminal(terminal.object, undefined, item.preserveFocus);
            yield activator.activateEnvironmentInTerminal(terminal.object, undefined, item.preserveFocus);
            yield activator.activateEnvironmentInTerminal(terminal.object, undefined, item.preserveFocus);
            terminal.verifyAll();
        }));
        test(`Terminal is activated only once ${titleSuffix} (even when not waiting)`, () => __awaiter(this, void 0, void 0, function* () {
            helper.setup(h => h.getTerminalShellPath()).returns(() => '');
            helper.setup(h => h.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(activationCommands));
            const terminal = TypeMoq.Mock.ofType();
            terminal
                .setup(t => t.show(TypeMoq.It.isValue(item.preserveFocus)))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.exactly(activationCommands.length));
            activationCommands.forEach(cmd => {
                terminal
                    .setup(t => t.sendText(TypeMoq.It.isValue(cmd)))
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.exactly(1));
            });
            const activated = yield Promise.all([
                activator.activateEnvironmentInTerminal(terminal.object, undefined, item.preserveFocus),
                activator.activateEnvironmentInTerminal(terminal.object, undefined, item.preserveFocus),
                activator.activateEnvironmentInTerminal(terminal.object, undefined, item.preserveFocus)
            ]);
            terminal.verifyAll();
            chai_1.expect(activated).to.deep.equal([true, true, true], 'Invalid values');
        }));
    });
});
//# sourceMappingURL=base.unit.test.js.map