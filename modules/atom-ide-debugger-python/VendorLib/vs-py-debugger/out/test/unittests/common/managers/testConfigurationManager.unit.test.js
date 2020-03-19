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
// tslint:disable:no-any
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../../client/common/types");
const enum_1 = require("../../../../client/common/utils/enum");
const constants_1 = require("../../../../client/unittests/common/constants");
const testConfigurationManager_1 = require("../../../../client/unittests/common/managers/testConfigurationManager");
const types_2 = require("../../../../client/unittests/common/types");
class MockTestConfigurationManager extends testConfigurationManager_1.TestConfigurationManager {
    requiresUserToConfigure(wkspace) {
        throw new Error('Method not implemented.');
    }
    configure(wkspace) {
        throw new Error('Method not implemented.');
    }
}
suite('Unit Test Configuration Manager (unit)', () => {
    [types_1.Product.pytest, types_1.Product.unittest, types_1.Product.nosetest].forEach(product => {
        const prods = enum_1.getNamesAndValues(types_1.Product);
        const productName = prods.filter(item => item.value === product)[0];
        suite(productName.name, () => {
            const workspaceUri = vscode_1.Uri.file(__dirname);
            let manager;
            let configService;
            setup(() => {
                configService = TypeMoq.Mock.ofType();
                const outputChannel = TypeMoq.Mock.ofType().object;
                const installer = TypeMoq.Mock.ofType().object;
                const serviceContainer = TypeMoq.Mock.ofType();
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.IOutputChannel), TypeMoq.It.isValue(constants_1.TEST_OUTPUT_CHANNEL))).returns(() => outputChannel);
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_2.ITestConfigSettingsService))).returns(() => configService.object);
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_1.IInstaller))).returns(() => installer);
                manager = new MockTestConfigurationManager(workspaceUri, product, serviceContainer.object);
            });
            test('Enabling a test product shoud disable other products', () => __awaiter(this, void 0, void 0, function* () {
                const testProducsToDisable = [types_1.Product.pytest, types_1.Product.unittest, types_1.Product.nosetest]
                    .filter(item => item !== product);
                testProducsToDisable.forEach(productToDisable => {
                    configService.setup(c => c.disable(TypeMoq.It.isValue(workspaceUri), TypeMoq.It.isValue(productToDisable)))
                        .returns(() => Promise.resolve(undefined))
                        .verifiable(TypeMoq.Times.once());
                });
                configService.setup(c => c.enable(TypeMoq.It.isValue(workspaceUri), TypeMoq.It.isValue(product)))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());
                yield manager.enable();
                configService.verifyAll();
            }));
        });
    });
});
//# sourceMappingURL=testConfigurationManager.unit.test.js.map