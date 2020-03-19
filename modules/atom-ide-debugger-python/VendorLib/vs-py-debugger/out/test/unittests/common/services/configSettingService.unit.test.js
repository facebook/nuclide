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
const chaiPromise = require("chai-as-promised");
const typeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../../client/common/application/types");
const types_2 = require("../../../../client/common/types");
const enum_1 = require("../../../../client/common/utils/enum");
const configSettingService_1 = require("../../../../client/unittests/common/services/configSettingService");
chai_1.use(chaiPromise);
const updateMethods = ['updateTestArgs', 'disable', 'enable'];
suite('Unit Tests - ConfigSettingsService', () => {
    [types_2.Product.pytest, types_2.Product.unittest, types_2.Product.nosetest].forEach(prodItem => {
        const product = prodItem;
        const prods = enum_1.getNamesAndValues(types_2.Product);
        const productName = prods.filter(item => item.value === product)[0];
        const workspaceUri = vscode_1.Uri.file(__filename);
        updateMethods.forEach(updateMethod => {
            suite(`Test '${updateMethod}' method with ${productName.name}`, () => {
                let testConfigSettingsService;
                let workspaceService;
                setup(() => {
                    const serviceContainer = typeMoq.Mock.ofType();
                    workspaceService = typeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
                    testConfigSettingsService = new configSettingService_1.TestConfigSettingsService(serviceContainer.object);
                });
                function getTestArgSetting(prod) {
                    switch (prod) {
                        case types_2.Product.unittest:
                            return 'unitTest.unittestArgs';
                        case types_2.Product.pytest:
                            return 'unitTest.pyTestArgs';
                        case types_2.Product.nosetest:
                            return 'unitTest.nosetestArgs';
                        default:
                            throw new Error('Invalid Test Product');
                    }
                }
                function getTestEnablingSetting(prod) {
                    switch (prod) {
                        case types_2.Product.unittest:
                            return 'unitTest.unittestEnabled';
                        case types_2.Product.pytest:
                            return 'unitTest.pyTestEnabled';
                        case types_2.Product.nosetest:
                            return 'unitTest.nosetestsEnabled';
                        default:
                            throw new Error('Invalid Test Product');
                    }
                }
                function getExpectedValueAndSettings() {
                    switch (updateMethod) {
                        case 'disable': {
                            return { configValue: false, configName: getTestEnablingSetting(product) };
                        }
                        case 'enable': {
                            return { configValue: true, configName: getTestEnablingSetting(product) };
                        }
                        case 'updateTestArgs': {
                            return { configValue: ['one', 'two', 'three'], configName: getTestArgSetting(product) };
                        }
                        default: {
                            throw new Error('Invalid Method');
                        }
                    }
                }
                test('Update Test Arguments with workspace Uri without workspaces', () => __awaiter(this, void 0, void 0, function* () {
                    workspaceService.setup(w => w.hasWorkspaceFolders)
                        .returns(() => false)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    const pythonConfig = typeMoq.Mock.ofType();
                    workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python')))
                        .returns(() => pythonConfig.object)
                        .verifiable(typeMoq.Times.once());
                    const { configValue, configName } = getExpectedValueAndSettings();
                    pythonConfig.setup(p => p.update(typeMoq.It.isValue(configName), typeMoq.It.isValue(configValue)))
                        .returns(() => Promise.resolve())
                        .verifiable(typeMoq.Times.once());
                    if (updateMethod === 'updateTestArgs') {
                        yield testConfigSettingsService.updateTestArgs(workspaceUri, product, configValue);
                    }
                    else {
                        yield testConfigSettingsService[updateMethod](workspaceUri, product);
                    }
                    workspaceService.verifyAll();
                    pythonConfig.verifyAll();
                }));
                test('Update Test Arguments with workspace Uri with one workspace', () => __awaiter(this, void 0, void 0, function* () {
                    workspaceService.setup(w => w.hasWorkspaceFolders)
                        .returns(() => true)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    const workspaceFolder = typeMoq.Mock.ofType();
                    workspaceFolder.setup(w => w.uri)
                        .returns(() => workspaceUri)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.workspaceFolders)
                        .returns(() => [workspaceFolder.object])
                        .verifiable(typeMoq.Times.atLeastOnce());
                    const pythonConfig = typeMoq.Mock.ofType();
                    workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python'), typeMoq.It.isValue(workspaceUri)))
                        .returns(() => pythonConfig.object)
                        .verifiable(typeMoq.Times.once());
                    const { configValue, configName } = getExpectedValueAndSettings();
                    pythonConfig.setup(p => p.update(typeMoq.It.isValue(configName), typeMoq.It.isValue(configValue)))
                        .returns(() => Promise.resolve())
                        .verifiable(typeMoq.Times.once());
                    if (updateMethod === 'updateTestArgs') {
                        yield testConfigSettingsService.updateTestArgs(workspaceUri, product, configValue);
                    }
                    else {
                        yield testConfigSettingsService[updateMethod](workspaceUri, product);
                    }
                    workspaceService.verifyAll();
                    pythonConfig.verifyAll();
                }));
                test('Update Test Arguments with workspace Uri with more than one workspace and uri belongs to a workspace', () => __awaiter(this, void 0, void 0, function* () {
                    workspaceService.setup(w => w.hasWorkspaceFolders)
                        .returns(() => true)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    const workspaceFolder = typeMoq.Mock.ofType();
                    workspaceFolder.setup(w => w.uri)
                        .returns(() => workspaceUri)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.workspaceFolders)
                        .returns(() => [workspaceFolder.object, workspaceFolder.object])
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.getWorkspaceFolder(typeMoq.It.isValue(workspaceUri)))
                        .returns(() => workspaceFolder.object)
                        .verifiable(typeMoq.Times.once());
                    const pythonConfig = typeMoq.Mock.ofType();
                    workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python'), typeMoq.It.isValue(workspaceUri)))
                        .returns(() => pythonConfig.object)
                        .verifiable(typeMoq.Times.once());
                    const { configValue, configName } = getExpectedValueAndSettings();
                    pythonConfig.setup(p => p.update(typeMoq.It.isValue(configName), typeMoq.It.isValue(configValue)))
                        .returns(() => Promise.resolve())
                        .verifiable(typeMoq.Times.once());
                    if (updateMethod === 'updateTestArgs') {
                        yield testConfigSettingsService.updateTestArgs(workspaceUri, product, configValue);
                    }
                    else {
                        yield testConfigSettingsService[updateMethod](workspaceUri, product);
                    }
                    workspaceService.verifyAll();
                    pythonConfig.verifyAll();
                }));
                test('Expect an exception when updating Test Arguments with workspace Uri with more than one workspace and uri does not belong to a workspace', () => __awaiter(this, void 0, void 0, function* () {
                    workspaceService.setup(w => w.hasWorkspaceFolders)
                        .returns(() => true)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    const workspaceFolder = typeMoq.Mock.ofType();
                    workspaceFolder.setup(w => w.uri)
                        .returns(() => workspaceUri)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.workspaceFolders)
                        .returns(() => [workspaceFolder.object, workspaceFolder.object])
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.getWorkspaceFolder(typeMoq.It.isValue(workspaceUri)))
                        .returns(() => undefined)
                        .verifiable(typeMoq.Times.once());
                    const { configValue } = getExpectedValueAndSettings();
                    const promise = testConfigSettingsService.updateTestArgs(workspaceUri, product, configValue);
                    chai_1.expect(promise).to.eventually.rejectedWith();
                    workspaceService.verifyAll();
                }));
            });
        });
    });
});
//# sourceMappingURL=configSettingService.unit.test.js.map