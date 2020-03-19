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
// tslint:disable:max-func-body-length no-any
const chai_1 = require("chai");
const typeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/application/types");
const constants_1 = require("../../../client/common/constants");
const types_2 = require("../../../client/common/types");
const async_1 = require("../../../client/common/utils/async");
const misc_1 = require("../../../client/common/utils/misc");
const constants_2 = require("../../../client/unittests/common/constants");
const types_3 = require("../../../client/unittests/common/types");
const main_1 = require("../../../client/unittests/display/main");
const core_1 = require("../../core");
suite('Unit Tests - TestResultDisplay', () => {
    const workspaceUri = vscode_1.Uri.file(__filename);
    let appShell;
    let unitTestSettings;
    let serviceContainer;
    let display;
    let testsHelper;
    let configurationService;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType();
        configurationService = typeMoq.Mock.ofType();
        appShell = typeMoq.Mock.ofType();
        unitTestSettings = typeMoq.Mock.ofType();
        const pythonSettings = typeMoq.Mock.ofType();
        testsHelper = typeMoq.Mock.ofType();
        pythonSettings.setup(p => p.unitTest).returns(() => unitTestSettings.object);
        configurationService.setup(c => c.getSettings(workspaceUri)).returns(() => pythonSettings.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_2.IConfigurationService))).returns(() => configurationService.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IApplicationShell))).returns(() => appShell.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_3.ITestsHelper))).returns(() => testsHelper.object);
    });
    teardown(() => {
        try {
            display.dispose();
        }
        catch (_a) {
            misc_1.noop();
        }
    });
    function createTestResultDisplay() {
        display = new main_1.TestResultDisplay(serviceContainer.object);
    }
    test('Should create a status bar item upon instantiation', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        appShell.verifyAll();
    }));
    test('Should be disabled upon instantiation', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        appShell.verifyAll();
        chai_1.expect(display.enabled).to.be.equal(false, 'not disabled');
    }));
    test('Enable display should show the statusbar', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        display.enabled = true;
        statusBar.verifyAll();
    }));
    test('Disable display should hide the statusbar', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.hide()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        display.enabled = false;
        statusBar.verifyAll();
    }));
    test('Ensure status bar is displayed and updated with progress with ability to stop tests', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        display.displayProgressStatus(async_1.createDeferred().promise, false);
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());
    }));
    test('Ensure status bar is updated with success with ability to view ui without any results', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        const def = async_1.createDeferred();
        display.displayProgressStatus(def.promise, false);
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());
        const tests = typeMoq.Mock.ofType();
        tests.setup((t) => t.then).returns(() => undefined);
        tests.setup(t => t.summary).returns(() => {
            return { errors: 0, failures: 0, passed: 0, skipped: 0 };
        }).verifiable(typeMoq.Times.atLeastOnce());
        appShell.setup(a => a.showWarningMessage(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typeMoq.Times.once());
        def.resolve(tests.object);
        yield core_1.sleep(1);
        tests.verifyAll();
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
    }));
    test('Ensure status bar is updated with success with ability to view ui with results', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        const def = async_1.createDeferred();
        display.displayProgressStatus(def.promise, false);
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());
        const tests = typeMoq.Mock.ofType();
        tests.setup((t) => t.then).returns(() => undefined);
        tests.setup(t => t.summary).returns(() => {
            return { errors: 0, failures: 0, passed: 1, skipped: 0 };
        }).verifiable(typeMoq.Times.atLeastOnce());
        appShell.setup(a => a.showWarningMessage(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typeMoq.Times.never());
        def.resolve(tests.object);
        yield core_1.sleep(1);
        tests.verifyAll();
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
    }));
    test('Ensure status bar is updated with error when cancelled by user with ability to view ui with results', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        const def = async_1.createDeferred();
        display.displayProgressStatus(def.promise, false);
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());
        testsHelper.setup(t => t.displayTestErrorMessage(typeMoq.It.isAny())).verifiable(typeMoq.Times.never());
        def.reject(constants_2.CANCELLATION_REASON);
        yield core_1.sleep(1);
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
        testsHelper.verifyAll();
    }));
    test('Ensure status bar is updated, and error message display with error in running tests, with ability to view ui with results', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        const def = async_1.createDeferred();
        display.displayProgressStatus(def.promise, false);
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());
        testsHelper.setup(t => t.displayTestErrorMessage(typeMoq.It.isAny())).verifiable(typeMoq.Times.once());
        def.reject('Some other reason');
        yield core_1.sleep(1);
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
        testsHelper.verifyAll();
    }));
    test('Ensure status bar is displayed and updated with progress with ability to stop test discovery', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        display.displayDiscoverStatus(async_1.createDeferred().promise, false).ignoreErrors();
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());
    }));
    test('Ensure status bar is displayed and updated with success and no tests, with ability to view ui to view results of test discovery', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        const def = async_1.createDeferred();
        display.displayDiscoverStatus(def.promise, false).ignoreErrors();
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());
        const tests = typeMoq.Mock.ofType();
        appShell.setup(a => a.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typeMoq.Times.once());
        def.resolve(undefined);
        yield core_1.sleep(1);
        tests.verifyAll();
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
    }));
    test('Ensure tests are disabled when there are errors and user choses to disable tests', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        const def = async_1.createDeferred();
        display.displayDiscoverStatus(def.promise, false).ignoreErrors();
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());
        const tests = typeMoq.Mock.ofType();
        appShell.setup(a => a.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((msg, item) => Promise.resolve(item))
            .verifiable(typeMoq.Times.once());
        for (const setting of ['unitTest.promptToConfigure', 'unitTest.pyTestEnabled',
            'unitTest.unittestEnabled', 'unitTest.nosetestsEnabled']) {
            configurationService.setup(c => c.updateSetting(typeMoq.It.isValue(setting), typeMoq.It.isValue(false)))
                .returns(() => Promise.resolve())
                .verifiable(typeMoq.Times.once());
        }
        def.resolve(undefined);
        yield core_1.sleep(1);
        tests.verifyAll();
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
        configurationService.verifyAll();
    }));
    test('Ensure status bar is displayed and updated with error info when test discovery is cancelled by the user', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        const def = async_1.createDeferred();
        display.displayDiscoverStatus(def.promise, false).ignoreErrors();
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());
        appShell.setup(a => a.showErrorMessage(typeMoq.It.isAny()))
            .verifiable(typeMoq.Times.never());
        def.reject(constants_2.CANCELLATION_REASON);
        yield core_1.sleep(1);
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Discover), typeMoq.Times.atLeastOnce());
        configurationService.verifyAll();
    }));
    test('Ensure status bar is displayed and updated with error info, and message is displayed when test discovery is fails due to errors', () => __awaiter(this, void 0, void 0, function* () {
        const statusBar = typeMoq.Mock.ofType();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());
        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());
        createTestResultDisplay();
        const def = async_1.createDeferred();
        display.displayDiscoverStatus(def.promise, false).ignoreErrors();
        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());
        appShell.setup(a => a.showErrorMessage(typeMoq.It.isAny()))
            .verifiable(typeMoq.Times.once());
        def.reject('some weird error');
        yield core_1.sleep(1);
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(constants_1.Commands.Tests_Discover), typeMoq.Times.atLeastOnce());
        configurationService.verifyAll();
    }));
});
//# sourceMappingURL=main.test.js.map