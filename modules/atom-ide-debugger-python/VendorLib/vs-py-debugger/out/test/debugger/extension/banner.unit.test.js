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
// tslint:disable:no-any max-func-body-length
const chai_1 = require("chai");
const typemoq = require("typemoq");
const types_1 = require("../../../client/common/application/types");
const types_2 = require("../../../client/common/types");
const constants_1 = require("../../../client/debugger/constants");
const banner_1 = require("../../../client/debugger/extension/banner");
suite('Debugging - Banner', () => {
    let serviceContainer;
    let browser;
    let launchCounterState;
    let launchThresholdCounterState;
    let showBannerState;
    let userSelected;
    let userSelectedState;
    let debugService;
    let appShell;
    let runtime;
    let banner;
    const message = 'Can you please take 2 minutes to tell us how the debugger is working for you?';
    const yes = 'Yes, take survey now';
    const no = 'No thanks';
    const later = 'Remind me later';
    setup(() => {
        serviceContainer = typemoq.Mock.ofType();
        browser = typemoq.Mock.ofType();
        debugService = typemoq.Mock.ofType();
        const logger = typemoq.Mock.ofType();
        launchCounterState = typemoq.Mock.ofType();
        showBannerState = typemoq.Mock.ofType();
        appShell = typemoq.Mock.ofType();
        runtime = typemoq.Mock.ofType();
        launchThresholdCounterState = typemoq.Mock.ofType();
        userSelected = true;
        userSelectedState = typemoq.Mock.ofType();
        const factory = typemoq.Mock.ofType();
        factory
            .setup(f => f.createGlobalPersistentState(typemoq.It.isValue(banner_1.PersistentStateKeys.DebuggerLaunchCounter), typemoq.It.isAny()))
            .returns(() => launchCounterState.object);
        factory
            .setup(f => f.createGlobalPersistentState(typemoq.It.isValue(banner_1.PersistentStateKeys.ShowBanner), typemoq.It.isAny()))
            .returns(() => showBannerState.object);
        factory
            .setup(f => f.createGlobalPersistentState(typemoq.It.isValue(banner_1.PersistentStateKeys.DebuggerLaunchThresholdCounter), typemoq.It.isAny()))
            .returns(() => launchThresholdCounterState.object);
        factory
            .setup(f => f.createGlobalPersistentState(typemoq.It.isValue(banner_1.PersistentStateKeys.UserSelected), typemoq.It.isAny()))
            .returns(() => userSelectedState.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IBrowserService))).returns(() => browser.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IPersistentStateFactory))).returns(() => factory.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_1.IDebugService))).returns(() => debugService.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.ILogger))).returns(() => logger.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IDisposableRegistry))).returns(() => []);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_1.IApplicationShell))).returns(() => appShell.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(types_2.IRandom))).returns(() => runtime.object);
        userSelectedState.setup(s => s.value)
            .returns(() => userSelected);
        banner = new banner_1.DebuggerBanner(serviceContainer.object);
    });
    test('Browser is displayed when launching service along with debugger launch counter', () => __awaiter(this, void 0, void 0, function* () {
        const debuggerLaunchCounter = 1234;
        launchCounterState.setup(l => l.value).returns(() => debuggerLaunchCounter).verifiable(typemoq.Times.once());
        browser.setup(b => b.launch(typemoq.It.isValue(`https://www.research.net/r/N7B25RV?n=${debuggerLaunchCounter}`)))
            .verifiable(typemoq.Times.once());
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no), typemoq.It.isValue(later)))
            .returns(() => Promise.resolve(yes));
        yield banner.show();
        launchCounterState.verifyAll();
        browser.verifyAll();
    }));
    for (let i = 0; i < 100; i = i + 1) {
        const randomSample = i;
        const expected = i < 10;
        test(`users are selected 10% of the time (random: ${i})`, () => __awaiter(this, void 0, void 0, function* () {
            showBannerState.setup(s => s.value).returns(() => true);
            launchCounterState.setup(l => l.value).returns(() => 10);
            launchThresholdCounterState.setup(t => t.value).returns(() => 10);
            userSelected = undefined;
            runtime.setup(r => r.getRandomInt(typemoq.It.isValue(0), typemoq.It.isValue(100)))
                .returns(() => randomSample);
            userSelectedState.setup(u => u.updateValue(typemoq.It.isValue(expected)))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            const selected = yield banner.shouldShow();
            chai_1.expect(selected).to.be.equal(expected, 'Incorrect value');
            userSelectedState.verifyAll();
        }));
    }
    for (const randomSample of [0, 10]) {
        const expected = randomSample < 10;
        test(`user selection does not change (random: ${randomSample})`, () => __awaiter(this, void 0, void 0, function* () {
            showBannerState.setup(s => s.value).returns(() => true);
            launchCounterState.setup(l => l.value).returns(() => 10);
            launchThresholdCounterState.setup(t => t.value).returns(() => 10);
            userSelected = undefined;
            runtime.setup(r => r.getRandomInt(typemoq.It.isValue(0), typemoq.It.isValue(100)))
                .returns(() => randomSample);
            userSelectedState.setup(u => u.updateValue(typemoq.It.isValue(expected)))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            const result1 = yield banner.shouldShow();
            userSelected = expected;
            const result2 = yield banner.shouldShow();
            chai_1.expect(result1).to.be.equal(expected, `randomSample ${randomSample}`);
            chai_1.expect(result2).to.be.equal(expected, `randomSample ${randomSample}`);
            userSelectedState.verifyAll();
        }));
    }
    test('Increment Debugger Launch Counter when debug session starts', () => __awaiter(this, void 0, void 0, function* () {
        let onDidTerminateDebugSessionCb;
        debugService.setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
            .callback(cb => onDidTerminateDebugSessionCb = cb)
            .verifiable(typemoq.Times.once());
        const debuggerLaunchCounter = 1234;
        launchCounterState.setup(l => l.value).returns(() => debuggerLaunchCounter)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.updateValue(typemoq.It.isValue(debuggerLaunchCounter + 1)))
            .verifiable(typemoq.Times.once());
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());
        banner.initialize();
        yield onDidTerminateDebugSessionCb({ type: constants_1.DebuggerTypeName });
        launchCounterState.verifyAll();
        browser.verifyAll();
        debugService.verifyAll();
        showBannerState.verifyAll();
    }));
    test('Do not Increment Debugger Launch Counter when debug session starts and Banner is disabled', () => __awaiter(this, void 0, void 0, function* () {
        debugService.setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
            .verifiable(typemoq.Times.never());
        const debuggerLaunchCounter = 1234;
        launchCounterState.setup(l => l.value).returns(() => debuggerLaunchCounter)
            .verifiable(typemoq.Times.never());
        launchCounterState.setup(l => l.updateValue(typemoq.It.isValue(debuggerLaunchCounter + 1)))
            .verifiable(typemoq.Times.never());
        showBannerState.setup(s => s.value).returns(() => false)
            .verifiable(typemoq.Times.atLeastOnce());
        banner.initialize();
        launchCounterState.verifyAll();
        browser.verifyAll();
        debugService.verifyAll();
        showBannerState.verifyAll();
    }));
    test('shouldShow must return false when Banner is disabled', () => __awaiter(this, void 0, void 0, function* () {
        showBannerState.setup(s => s.value).returns(() => false)
            .verifiable(typemoq.Times.once());
        chai_1.expect(yield banner.shouldShow()).to.be.equal(false, 'Incorrect value');
        showBannerState.verifyAll();
    }));
    test('shouldShow must return false when Banner is enabled and debug counter is not same as threshold', () => __awaiter(this, void 0, void 0, function* () {
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.once());
        launchCounterState.setup(l => l.value).returns(() => 1)
            .verifiable(typemoq.Times.once());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());
        chai_1.expect(yield banner.shouldShow()).to.be.equal(false, 'Incorrect value');
        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
    }));
    test('shouldShow must return true when Banner is enabled and debug counter is same as threshold', () => __awaiter(this, void 0, void 0, function* () {
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.once());
        launchCounterState.setup(l => l.value).returns(() => 10)
            .verifiable(typemoq.Times.once());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());
        chai_1.expect(yield banner.shouldShow()).to.be.equal(true, 'Incorrect value');
        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
    }));
    test('show must be invoked when shouldShow returns true', () => __awaiter(this, void 0, void 0, function* () {
        let onDidTerminateDebugSessionCb;
        const currentLaunchCounter = 50;
        debugService.setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
            .callback(cb => onDidTerminateDebugSessionCb = cb)
            .verifiable(typemoq.Times.atLeastOnce());
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.value).returns(() => currentLaunchCounter)
            .verifiable(typemoq.Times.atLeastOnce());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.updateValue(typemoq.It.isValue(currentLaunchCounter + 1)))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.atLeastOnce());
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no), typemoq.It.isValue(later)))
            .verifiable(typemoq.Times.once());
        banner.initialize();
        yield onDidTerminateDebugSessionCb({ type: constants_1.DebuggerTypeName });
        appShell.verifyAll();
        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
    }));
    test('show must not be invoked the second time after dismissing the message', () => __awaiter(this, void 0, void 0, function* () {
        let onDidTerminateDebugSessionCb;
        let currentLaunchCounter = 50;
        debugService.setup(d => d.onDidTerminateDebugSession(typemoq.It.isAny()))
            .callback(cb => onDidTerminateDebugSessionCb = cb)
            .verifiable(typemoq.Times.atLeastOnce());
        showBannerState.setup(s => s.value).returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.value).returns(() => currentLaunchCounter)
            .verifiable(typemoq.Times.atLeastOnce());
        launchThresholdCounterState.setup(t => t.value).returns(() => 10)
            .verifiable(typemoq.Times.atLeastOnce());
        launchCounterState.setup(l => l.updateValue(typemoq.It.isAny()))
            .callback(() => currentLaunchCounter = currentLaunchCounter + 1);
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no), typemoq.It.isValue(later)))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());
        banner.initialize();
        yield onDidTerminateDebugSessionCb({ type: constants_1.DebuggerTypeName });
        yield onDidTerminateDebugSessionCb({ type: constants_1.DebuggerTypeName });
        yield onDidTerminateDebugSessionCb({ type: constants_1.DebuggerTypeName });
        yield onDidTerminateDebugSessionCb({ type: constants_1.DebuggerTypeName });
        appShell.verifyAll();
        showBannerState.verifyAll();
        launchCounterState.verifyAll();
        launchThresholdCounterState.verifyAll();
        chai_1.expect(currentLaunchCounter).to.be.equal(54);
    }));
    test('Disabling banner must store value of \'false\' in global store', () => __awaiter(this, void 0, void 0, function* () {
        showBannerState.setup(s => s.updateValue(typemoq.It.isValue(false)))
            .verifiable(typemoq.Times.once());
        yield banner.disable();
        showBannerState.verifyAll();
    }));
});
//# sourceMappingURL=banner.unit.test.js.map