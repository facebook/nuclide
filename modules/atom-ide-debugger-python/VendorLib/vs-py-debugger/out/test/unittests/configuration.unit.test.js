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
const types_1 = require("../../client/common/application/types");
const types_2 = require("../../client/common/types");
const enum_1 = require("../../client/common/utils/enum");
const constants_1 = require("../../client/unittests/common/constants");
const configuration_1 = require("../../client/unittests/configuration");
const types_3 = require("../../client/unittests/types");
suite('Unit Tests - ConfigurationService', () => {
    [types_2.Product.pytest, types_2.Product.unittest, types_2.Product.nosetest].forEach(prodItem => {
        const product = prodItem;
        const prods = enum_1.getNamesAndValues(types_2.Product);
        const productName = prods.filter(item => item.value === product)[0];
        const workspaceUri = vscode_1.Uri.file(__filename);
        suite(productName.name, () => {
            let testConfigService;
            let workspaceService;
            let factory;
            let appShell;
            let unitTestSettings;
            setup(() => {
                const serviceContainer = typeMoq.Mock.ofType();
                const configurationService = typeMoq.Mock.ofType();
                appShell = typeMoq.Mock.ofType();
                const outputChannel = typeMoq.Mock.ofType();
                const installer = typeMoq.Mock.ofType();
                workspaceService = typeMoq.Mock.ofType();
                factory = typeMoq.Mock.ofType();
                unitTestSettings = typeMoq.Mock.ofType();
                const pythonSettings = typeMoq.Mock.ofType();
                pythonSettings.setup(p => p.unitTest).returns(() => unitTestSettings.object);
                configurationService.setup(c => c.getSettings(workspaceUri)).returns(() => pythonSettings.object);
                serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_2.IOutputChannel), typeMoq.It.isValue(constants_1.TEST_OUTPUT_CHANNEL))).returns(() => outputChannel.object);
                serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_2.IInstaller))).returns(() => installer.object);
                serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_2.IConfigurationService))).returns(() => configurationService.object);
                serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IApplicationShell))).returns(() => appShell.object);
                serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
                serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_3.ITestConfigurationManagerFactory))).returns(() => factory.object);
                testConfigService = typeMoq.Mock.ofType(configuration_1.UnitTestConfigurationService, typeMoq.MockBehavior.Loose, true, serviceContainer.object);
            });
            test('Enable Test when setting unitTest.promptToConfigure is enabled', () => __awaiter(this, void 0, void 0, function* () {
                const configMgr = typeMoq.Mock.ofType();
                configMgr.setup(c => c.enable())
                    .returns(() => Promise.resolve())
                    .verifiable(typeMoq.Times.once());
                factory.setup(f => f.create(workspaceUri, product))
                    .returns(() => configMgr.object)
                    .verifiable(typeMoq.Times.once());
                const workspaceConfig = typeMoq.Mock.ofType();
                workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python'), workspaceUri))
                    .returns(() => workspaceConfig.object)
                    .verifiable(typeMoq.Times.once());
                workspaceConfig.setup(w => w.get(typeMoq.It.isValue('unitTest.promptToConfigure')))
                    .returns(() => true)
                    .verifiable(typeMoq.Times.once());
                yield testConfigService.target.enableTest(workspaceUri, product);
                configMgr.verifyAll();
                factory.verifyAll();
                workspaceService.verifyAll();
                workspaceConfig.verifyAll();
            }));
            test('Enable Test when setting unitTest.promptToConfigure is disabled', () => __awaiter(this, void 0, void 0, function* () {
                const configMgr = typeMoq.Mock.ofType();
                configMgr.setup(c => c.enable())
                    .returns(() => Promise.resolve())
                    .verifiable(typeMoq.Times.once());
                factory.setup(f => f.create(workspaceUri, product))
                    .returns(() => configMgr.object)
                    .verifiable(typeMoq.Times.once());
                const workspaceConfig = typeMoq.Mock.ofType();
                workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python'), workspaceUri))
                    .returns(() => workspaceConfig.object)
                    .verifiable(typeMoq.Times.once());
                workspaceConfig.setup(w => w.get(typeMoq.It.isValue('unitTest.promptToConfigure')))
                    .returns(() => false)
                    .verifiable(typeMoq.Times.once());
                workspaceConfig.setup(w => w.update(typeMoq.It.isValue('unitTest.promptToConfigure'), typeMoq.It.isValue(undefined)))
                    .returns(() => Promise.resolve())
                    .verifiable(typeMoq.Times.once());
                yield testConfigService.target.enableTest(workspaceUri, product);
                configMgr.verifyAll();
                factory.verifyAll();
                workspaceService.verifyAll();
                workspaceConfig.verifyAll();
            }));
            test('Enable Test when setting unitTest.promptToConfigure is disabled and fail to update the settings', () => __awaiter(this, void 0, void 0, function* () {
                const configMgr = typeMoq.Mock.ofType();
                configMgr.setup(c => c.enable())
                    .returns(() => Promise.resolve())
                    .verifiable(typeMoq.Times.once());
                factory.setup(f => f.create(workspaceUri, product))
                    .returns(() => configMgr.object)
                    .verifiable(typeMoq.Times.once());
                const workspaceConfig = typeMoq.Mock.ofType();
                workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python'), workspaceUri))
                    .returns(() => workspaceConfig.object)
                    .verifiable(typeMoq.Times.once());
                workspaceConfig.setup(w => w.get(typeMoq.It.isValue('unitTest.promptToConfigure')))
                    .returns(() => false)
                    .verifiable(typeMoq.Times.once());
                const errorMessage = 'Update Failed';
                const updateFailError = new Error(errorMessage);
                workspaceConfig.setup(w => w.update(typeMoq.It.isValue('unitTest.promptToConfigure'), typeMoq.It.isValue(undefined)))
                    .returns(() => Promise.reject(updateFailError))
                    .verifiable(typeMoq.Times.once());
                const promise = testConfigService.target.enableTest(workspaceUri, product);
                yield chai_1.expect(promise).to.eventually.be.rejectedWith(errorMessage);
                configMgr.verifyAll();
                factory.verifyAll();
                workspaceService.verifyAll();
                workspaceConfig.verifyAll();
            }));
            test('Select Test runner displays 3 items', () => __awaiter(this, void 0, void 0, function* () {
                const placeHolder = 'Some message';
                appShell.setup(s => s.showQuickPick(typeMoq.It.isAny(), typeMoq.It.isObjectWith({ placeHolder })))
                    .callback(items => chai_1.expect(items).be.lengthOf(3))
                    .verifiable(typeMoq.Times.once());
                yield testConfigService.target.selectTestRunner(placeHolder);
                appShell.verifyAll();
            }));
            test('Ensure selected item is returned', () => __awaiter(this, void 0, void 0, function* () {
                const placeHolder = 'Some message';
                const indexes = [types_2.Product.unittest, types_2.Product.pytest, types_2.Product.nosetest];
                appShell.setup(s => s.showQuickPick(typeMoq.It.isAny(), typeMoq.It.isObjectWith({ placeHolder })))
                    .callback(items => chai_1.expect(items).be.lengthOf(3))
                    .returns((items) => items[indexes.indexOf(product)])
                    .verifiable(typeMoq.Times.once());
                const selectedItem = yield testConfigService.target.selectTestRunner(placeHolder);
                chai_1.expect(selectedItem).to.be.equal(product);
                appShell.verifyAll();
            }));
            test('Ensure undefined is returned when nothing is seleted', () => __awaiter(this, void 0, void 0, function* () {
                const placeHolder = 'Some message';
                appShell.setup(s => s.showQuickPick(typeMoq.It.isAny(), typeMoq.It.isObjectWith({ placeHolder })))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(typeMoq.Times.once());
                const selectedItem = yield testConfigService.target.selectTestRunner(placeHolder);
                chai_1.expect(selectedItem).to.be.equal(undefined, 'invalid value');
                appShell.verifyAll();
            }));
            test('Prompt to enable a test if a test framework is not enabled', () => __awaiter(this, void 0, void 0, function* () {
                unitTestSettings.setup(u => u.pyTestEnabled).returns(() => false);
                unitTestSettings.setup(u => u.unittestEnabled).returns(() => false);
                unitTestSettings.setup(u => u.nosetestsEnabled).returns(() => false);
                appShell.setup(s => s.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny()))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(typeMoq.Times.once());
                let exceptionThrown = false;
                try {
                    yield testConfigService.target.displayTestFrameworkError(workspaceUri);
                }
                catch (_a) {
                    exceptionThrown = true;
                }
                chai_1.expect(exceptionThrown).to.be.equal(true, 'Exception not thrown');
                appShell.verifyAll();
            }));
            test('Prompt to select a test if a test framework is not enabled', () => __awaiter(this, void 0, void 0, function* () {
                unitTestSettings.setup(u => u.pyTestEnabled).returns(() => false);
                unitTestSettings.setup(u => u.unittestEnabled).returns(() => false);
                unitTestSettings.setup(u => u.nosetestsEnabled).returns(() => false);
                appShell.setup(s => s.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny()))
                    .returns((_msg, option) => Promise.resolve(option))
                    .verifiable(typeMoq.Times.once());
                let exceptionThrown = false;
                let selectTestRunnerInvoked = false;
                try {
                    testConfigService.callBase = false;
                    testConfigService.setup(t => t.selectTestRunner(typeMoq.It.isAny()))
                        .returns(() => {
                        selectTestRunnerInvoked = true;
                        return Promise.resolve(undefined);
                    });
                    yield testConfigService.target.displayTestFrameworkError(workspaceUri);
                }
                catch (_b) {
                    exceptionThrown = true;
                }
                chai_1.expect(selectTestRunnerInvoked).to.be.equal(true, 'Method not invoked');
                chai_1.expect(exceptionThrown).to.be.equal(true, 'Exception not thrown');
                appShell.verifyAll();
            }));
            test('Configure selected test framework and disable others', () => __awaiter(this, void 0, void 0, function* () {
                unitTestSettings.setup(u => u.pyTestEnabled).returns(() => false);
                unitTestSettings.setup(u => u.unittestEnabled).returns(() => false);
                unitTestSettings.setup(u => u.nosetestsEnabled).returns(() => false);
                appShell.setup(s => s.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny()))
                    .returns((_msg, option) => Promise.resolve(option))
                    .verifiable(typeMoq.Times.once());
                let selectTestRunnerInvoked = false;
                testConfigService.callBase = false;
                testConfigService.setup(t => t.selectTestRunner(typeMoq.It.isAny()))
                    .returns(() => {
                    selectTestRunnerInvoked = true;
                    return Promise.resolve(product);
                });
                let enableTestInvoked = false;
                testConfigService.setup(t => t.enableTest(typeMoq.It.isValue(workspaceUri), typeMoq.It.isValue(product)))
                    .returns(() => {
                    enableTestInvoked = true;
                    return Promise.resolve();
                });
                const configMgr = typeMoq.Mock.ofType();
                factory.setup(f => f.create(typeMoq.It.isValue(workspaceUri), typeMoq.It.isValue(product)))
                    .returns(() => configMgr.object)
                    .verifiable(typeMoq.Times.once());
                configMgr.setup(c => c.configure(typeMoq.It.isValue(workspaceUri)))
                    .returns(() => Promise.resolve())
                    .verifiable(typeMoq.Times.once());
                yield testConfigService.target.displayTestFrameworkError(workspaceUri);
                chai_1.expect(selectTestRunnerInvoked).to.be.equal(true, 'Select Test Runner not invoked');
                chai_1.expect(enableTestInvoked).to.be.equal(true, 'Enable Test not invoked');
                appShell.verifyAll();
                factory.verifyAll();
                configMgr.verifyAll();
            }));
            test('If more than one test framework is enabled, then prompt to select a test framework', () => __awaiter(this, void 0, void 0, function* () {
                unitTestSettings.setup(u => u.pyTestEnabled).returns(() => true);
                unitTestSettings.setup(u => u.unittestEnabled).returns(() => true);
                unitTestSettings.setup(u => u.nosetestsEnabled).returns(() => true);
                appShell.setup(s => s.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny()))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(typeMoq.Times.never());
                let exceptionThrown = false;
                try {
                    yield testConfigService.target.displayTestFrameworkError(workspaceUri);
                }
                catch (_c) {
                    exceptionThrown = true;
                }
                chai_1.expect(exceptionThrown).to.be.equal(true, 'Exception not thrown');
                appShell.verifyAll();
            }));
            test('If more than one test framework is enabled, then prompt to select a test framework and enable test, but do not configure', () => __awaiter(this, void 0, void 0, function* () {
                unitTestSettings.setup(u => u.pyTestEnabled).returns(() => true);
                unitTestSettings.setup(u => u.unittestEnabled).returns(() => true);
                unitTestSettings.setup(u => u.nosetestsEnabled).returns(() => true);
                appShell.setup(s => s.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny()))
                    .returns((_msg, option) => Promise.resolve(option))
                    .verifiable(typeMoq.Times.never());
                let selectTestRunnerInvoked = false;
                testConfigService.callBase = false;
                testConfigService.setup(t => t.selectTestRunner(typeMoq.It.isAny()))
                    .returns(() => {
                    selectTestRunnerInvoked = true;
                    return Promise.resolve(product);
                });
                let enableTestInvoked = false;
                testConfigService.setup(t => t.enableTest(typeMoq.It.isValue(workspaceUri), typeMoq.It.isValue(product)))
                    .returns(() => {
                    enableTestInvoked = true;
                    return Promise.resolve();
                });
                const configMgr = typeMoq.Mock.ofType();
                factory.setup(f => f.create(typeMoq.It.isValue(workspaceUri), typeMoq.It.isValue(product)))
                    .returns(() => configMgr.object)
                    .verifiable(typeMoq.Times.once());
                configMgr.setup(c => c.configure(typeMoq.It.isValue(workspaceUri)))
                    .returns(() => Promise.resolve())
                    .verifiable(typeMoq.Times.never());
                const configManagersToVerify = [configMgr];
                [types_2.Product.unittest, types_2.Product.pytest, types_2.Product.nosetest]
                    .filter(prod => product !== prod)
                    .forEach(prod => {
                    const otherTestConfigMgr = typeMoq.Mock.ofType();
                    factory.setup(f => f.create(typeMoq.It.isValue(workspaceUri), typeMoq.It.isValue(prod)))
                        .returns(() => otherTestConfigMgr.object)
                        .verifiable(typeMoq.Times.once());
                    otherTestConfigMgr.setup(c => c.disable())
                        .returns(() => Promise.resolve())
                        .verifiable(typeMoq.Times.once());
                    configManagersToVerify.push(otherTestConfigMgr);
                });
                yield testConfigService.target.displayTestFrameworkError(workspaceUri);
                chai_1.expect(selectTestRunnerInvoked).to.be.equal(true, 'Select Test Runner not invoked');
                chai_1.expect(enableTestInvoked).to.be.equal(false, 'Enable Test is invoked');
                factory.verifyAll();
                appShell.verifyAll();
                for (const item of configManagersToVerify) {
                    item.verifyAll();
                }
            }));
        });
    });
});
//# sourceMappingURL=configuration.unit.test.js.map