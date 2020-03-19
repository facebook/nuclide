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
// tslint:disable:max-func-body-length no-invalid-this
const assert_1 = require("assert");
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
require("../../../client/common/extensions");
const productInstaller_1 = require("../../../client/common/installer/productInstaller");
const productPath_1 = require("../../../client/common/installer/productPath");
const productService_1 = require("../../../client/common/installer/productService");
const types_1 = require("../../../client/common/installer/types");
const types_2 = require("../../../client/common/types");
const enum_1 = require("../../../client/common/utils/enum");
const types_3 = require("../../../client/formatters/types");
const types_4 = require("../../../client/linters/types");
const types_5 = require("../../../client/unittests/common/types");
chai_1.use(chaiAsPromised);
suite('Product Path', () => {
    [undefined, vscode_1.Uri.file('resource')].forEach(resource => {
        enum_1.getNamesAndValues(types_2.Product).forEach(product => {
            let serviceContainer;
            let formattingSettings;
            let unitTestSettings;
            let workspaceSymnbolSettings;
            let configService;
            let productInstaller;
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType();
                configService = TypeMoq.Mock.ofType();
                formattingSettings = TypeMoq.Mock.ofType();
                unitTestSettings = TypeMoq.Mock.ofType();
                workspaceSymnbolSettings = TypeMoq.Mock.ofType();
                productInstaller = new productInstaller_1.ProductInstaller(serviceContainer.object, TypeMoq.Mock.ofType().object);
                const pythonSettings = TypeMoq.Mock.ofType();
                pythonSettings.setup(p => p.formatting).returns(() => formattingSettings.object);
                pythonSettings.setup(p => p.unitTest).returns(() => unitTestSettings.object);
                pythonSettings.setup(p => p.workspaceSymbols).returns(() => workspaceSymnbolSettings.object);
                configService.setup(s => s.getSettings(TypeMoq.It.isValue(resource)))
                    .returns(() => pythonSettings.object);
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_2.IConfigurationService), TypeMoq.It.isAny()))
                    .returns(() => configService.object);
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_2.IInstaller), TypeMoq.It.isAny()))
                    .returns(() => productInstaller);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IProductService), TypeMoq.It.isAny())).returns(() => new productService_1.ProductService());
            });
            if (product.value === types_2.Product.isort) {
                return;
            }
            const productType = new productService_1.ProductService().getProductType(product.value);
            switch (productType) {
                case types_2.ProductType.Formatter: {
                    test(`Ensure path is returned for ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const productPathService = new productPath_1.FormatterProductPathService(serviceContainer.object);
                        const formatterHelper = TypeMoq.Mock.ofType();
                        const expectedPath = 'Some Path';
                        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_3.IFormatterHelper), TypeMoq.It.isAny()))
                            .returns(() => formatterHelper.object);
                        formattingSettings.setup(f => f.autopep8Path)
                            .returns(() => expectedPath)
                            .verifiable(TypeMoq.Times.atLeastOnce());
                        formatterHelper.setup(f => f.getSettingsPropertyNames(TypeMoq.It.isValue(product.value)))
                            .returns(() => {
                            return {
                                pathName: 'autopep8Path',
                                argsName: 'autopep8Args'
                            };
                        })
                            .verifiable(TypeMoq.Times.once());
                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        chai_1.expect(value).to.be.equal(expectedPath);
                        formattingSettings.verifyAll();
                        formatterHelper.verifyAll();
                    }));
                    break;
                }
                case types_2.ProductType.Linter: {
                    test(`Ensure path is returned for ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const productPathService = new productPath_1.LinterProductPathService(serviceContainer.object);
                        const linterManager = TypeMoq.Mock.ofType();
                        const linterInfo = TypeMoq.Mock.ofType();
                        const expectedPath = 'Some Path';
                        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_4.ILinterManager), TypeMoq.It.isAny()))
                            .returns(() => linterManager.object);
                        linterInfo.setup(l => l.pathName(TypeMoq.It.isValue(resource)))
                            .returns(() => expectedPath)
                            .verifiable(TypeMoq.Times.once());
                        linterManager.setup(l => l.getLinterInfo(TypeMoq.It.isValue(product.value)))
                            .returns(() => linterInfo.object)
                            .verifiable(TypeMoq.Times.once());
                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        chai_1.expect(value).to.be.equal(expectedPath);
                        linterInfo.verifyAll();
                        linterManager.verifyAll();
                    }));
                }
                case types_2.ProductType.RefactoringLibrary: {
                    test(`Ensure path is returned for ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const productPathService = new productPath_1.RefactoringLibraryProductPathService(serviceContainer.object);
                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        const moduleName = productInstaller.translateProductToModuleName(product.value, types_2.ModuleNamePurpose.run);
                        chai_1.expect(value).to.be.equal(moduleName);
                    }));
                    break;
                }
                case types_2.ProductType.WorkspaceSymbols: {
                    test(`Ensure path is returned for ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const productPathService = new productPath_1.CTagsProductPathService(serviceContainer.object);
                        const expectedPath = 'Some Path';
                        workspaceSymnbolSettings.setup(w => w.ctagsPath)
                            .returns(() => expectedPath)
                            .verifiable(TypeMoq.Times.atLeastOnce());
                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        chai_1.expect(value).to.be.equal(expectedPath);
                        workspaceSymnbolSettings.verifyAll();
                    }));
                    break;
                }
                case types_2.ProductType.TestFramework: {
                    test(`Ensure path is returned for ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const productPathService = new productPath_1.TestFrameworkProductPathService(serviceContainer.object);
                        const testHelper = TypeMoq.Mock.ofType();
                        const expectedPath = 'Some Path';
                        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_5.ITestsHelper), TypeMoq.It.isAny()))
                            .returns(() => testHelper.object);
                        testHelper.setup(t => t.getSettingsPropertyNames(TypeMoq.It.isValue(product.value)))
                            .returns(() => {
                            return {
                                argsName: 'autoTestDiscoverOnSaveEnabled',
                                enabledName: 'autoTestDiscoverOnSaveEnabled',
                                pathName: 'nosetestPath'
                            };
                        })
                            .verifiable(TypeMoq.Times.once());
                        unitTestSettings.setup(u => u.nosetestPath)
                            .returns(() => expectedPath)
                            .verifiable(TypeMoq.Times.atLeastOnce());
                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        chai_1.expect(value).to.be.equal(expectedPath);
                        testHelper.verifyAll();
                        unitTestSettings.verifyAll();
                    }));
                    test(`Ensure module name is returned for ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const productPathService = new productPath_1.TestFrameworkProductPathService(serviceContainer.object);
                        const testHelper = TypeMoq.Mock.ofType();
                        serviceContainer.setup(s => s.get(TypeMoq.It.isValue(types_5.ITestsHelper), TypeMoq.It.isAny()))
                            .returns(() => testHelper.object);
                        testHelper.setup(t => t.getSettingsPropertyNames(TypeMoq.It.isValue(product.value)))
                            .returns(() => {
                            return {
                                argsName: 'autoTestDiscoverOnSaveEnabled',
                                enabledName: 'autoTestDiscoverOnSaveEnabled',
                                pathName: undefined
                            };
                        })
                            .verifiable(TypeMoq.Times.once());
                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        const moduleName = productInstaller.translateProductToModuleName(product.value, types_2.ModuleNamePurpose.run);
                        chai_1.expect(value).to.be.equal(moduleName);
                        testHelper.verifyAll();
                    }));
                    break;
                }
                default: {
                    test(`No tests for Product Path of this Product Type ${product.name}`, () => {
                        assert_1.fail('No tests for Product Path of this Product Type');
                    });
                }
            }
        });
    });
});
//# sourceMappingURL=productPath.unit.test.js.map