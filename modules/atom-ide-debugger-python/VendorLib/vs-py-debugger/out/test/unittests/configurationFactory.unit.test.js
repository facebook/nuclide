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
const chaiAsPromised = require("chai-as-promised");
const typeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/types");
const constants_1 = require("../../client/unittests/common/constants");
const types_2 = require("../../client/unittests/common/types");
const configurationFactory_1 = require("../../client/unittests/configurationFactory");
const nose = require("../../client/unittests/nosetest/testConfigurationManager");
const pytest = require("../../client/unittests/pytest/testConfigurationManager");
const unittest = require("../../client/unittests/unittest/testConfigurationManager");
chai_1.use(chaiAsPromised);
suite('Unit Tests - ConfigurationManagerFactory', () => {
    let factory;
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType();
        const outputChannel = typeMoq.Mock.ofType();
        const installer = typeMoq.Mock.ofType();
        const testConfigService = typeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IOutputChannel), typeMoq.It.isValue(constants_1.TEST_OUTPUT_CHANNEL))).returns(() => outputChannel.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_1.IInstaller))).returns(() => installer.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(types_2.ITestConfigSettingsService))).returns(() => testConfigService.object);
        factory = new configurationFactory_1.TestConfigurationManagerFactory(serviceContainer.object);
    });
    test('Create Unit Test Configuration', () => __awaiter(this, void 0, void 0, function* () {
        const configMgr = factory.create(vscode_1.Uri.file(__filename), types_1.Product.unittest);
        chai_1.expect(configMgr).to.be.instanceOf(unittest.ConfigurationManager);
    }));
    test('Create pytest Configuration', () => __awaiter(this, void 0, void 0, function* () {
        const configMgr = factory.create(vscode_1.Uri.file(__filename), types_1.Product.pytest);
        chai_1.expect(configMgr).to.be.instanceOf(pytest.ConfigurationManager);
    }));
    test('Create nose Configuration', () => __awaiter(this, void 0, void 0, function* () {
        const configMgr = factory.create(vscode_1.Uri.file(__filename), types_1.Product.nosetest);
        chai_1.expect(configMgr).to.be.instanceOf(nose.ConfigurationManager);
    }));
});
//# sourceMappingURL=configurationFactory.unit.test.js.map