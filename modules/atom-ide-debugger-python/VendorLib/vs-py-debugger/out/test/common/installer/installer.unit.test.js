"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/application/types");
require("../../../client/common/extensions");
const productInstaller_1 = require("../../../client/common/installer/productInstaller");
const productService_1 = require("../../../client/common/installer/productService");
const types_2 = require("../../../client/common/installer/types");
const types_3 = require("../../../client/common/types");
const async_1 = require("../../../client/common/utils/async");
const enum_1 = require("../../../client/common/utils/enum");
chai_1.use(chaiAsPromised);
suite('Module Installer', () => {
    [undefined, vscode_1.Uri.file('resource')].forEach(resource => {
        enum_1.getNamesAndValues(types_3.Product).forEach(product => {
            let disposables = [];
            let installer;
            let installationChannel;
            let moduleInstaller;
            let serviceContainer;
            let app;
            let promptDeferred;
            let workspaceService;
            setup(() => {
                promptDeferred = async_1.createDeferred();
                serviceContainer = TypeMoq.Mock.ofType();
                const outputChannel = TypeMoq.Mock.ofType();
                disposables = [];
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IProductService), TypeMoq.It.isAny())).returns(() => new productService_1.ProductService());
                installationChannel = TypeMoq.Mock.ofType();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IInstallationChannelManager), TypeMoq.It.isAny())).returns(() => installationChannel.object);
                app = TypeMoq.Mock.ofType();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IApplicationShell), TypeMoq.It.isAny())).returns(() => app.object);
                workspaceService = TypeMoq.Mock.ofType();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService), TypeMoq.It.isAny())).returns(() => workspaceService.object);
                moduleInstaller = TypeMoq.Mock.ofType();
                // tslint:disable-next-line:no-any
                moduleInstaller.setup((x) => x.then).returns(() => undefined);
                installationChannel.setup(i => i.getInstallationChannel(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(moduleInstaller.object));
                installationChannel.setup(i => i.getInstallationChannel(TypeMoq.It.isAny())).returns(() => Promise.resolve(moduleInstaller.object));
                const productPathService = TypeMoq.Mock.ofType();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IProductPathService), TypeMoq.It.isAny())).returns(() => productPathService.object);
                productPathService.setup(p => p.getExecutableNameFromSettings(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource))).returns(() => 'xyz');
                productPathService.setup(p => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource))).returns(() => true);
                installer = new productInstaller_1.ProductInstaller(serviceContainer.object, outputChannel.object);
            });
            teardown(() => {
                // This must be resolved, else all subsequent tests will fail (as this same promise will be used for other tests).
                promptDeferred.resolve();
                disposables.forEach(disposable => {
                    if (disposable) {
                        disposable.dispose();
                    }
                });
            });
            switch (product.value) {
                case types_3.Product.isort:
                case types_3.Product.ctags: {
                    return;
                }
                case types_3.Product.unittest: {
                    test(`Ensure resource info is passed into the module installer ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const response = yield installer.install(product.value, resource);
                        chai_1.expect(response).to.be.equal(types_3.InstallerResponse.Installed);
                    }));
                    test(`Ensure resource info is passed into the module installer  (created using ProductInstaller) ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const response = yield installer.install(product.value, resource);
                        chai_1.expect(response).to.be.equal(types_3.InstallerResponse.Installed);
                    }));
                }
                default: {
                    test(`Ensure resource info is passed into the module installer ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const moduleName = installer.translateProductToModuleName(product.value, types_3.ModuleNamePurpose.install);
                        const logger = TypeMoq.Mock.ofType();
                        logger.setup(l => l.logError(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => new Error('UnitTesting'));
                        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.ILogger), TypeMoq.It.isAny())).returns(() => logger.object);
                        moduleInstaller.setup(m => m.installModule(TypeMoq.It.isValue(moduleName), TypeMoq.It.isValue(resource))).returns(() => Promise.reject(new Error('UnitTesting')));
                        try {
                            yield installer.install(product.value, resource);
                        }
                        catch (ex) {
                            moduleInstaller.verify(m => m.installModule(TypeMoq.It.isValue(moduleName), TypeMoq.It.isValue(resource)), TypeMoq.Times.once());
                        }
                    }));
                    test(`Ensure resource info is passed into the module installer (created using ProductInstaller) ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                        const moduleName = installer.translateProductToModuleName(product.value, types_3.ModuleNamePurpose.install);
                        const logger = TypeMoq.Mock.ofType();
                        logger.setup(l => l.logError(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => new Error('UnitTesting'));
                        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.ILogger), TypeMoq.It.isAny())).returns(() => logger.object);
                        moduleInstaller.setup(m => m.installModule(TypeMoq.It.isValue(moduleName), TypeMoq.It.isValue(resource))).returns(() => Promise.reject(new Error('UnitTesting')));
                        try {
                            yield installer.install(product.value, resource);
                        }
                        catch (ex) {
                            moduleInstaller.verify(m => m.installModule(TypeMoq.It.isValue(moduleName), TypeMoq.It.isValue(resource)), TypeMoq.Times.once());
                        }
                    }));
                    if (product.value !== types_3.Product.unittest) {
                        test(`Ensure the prompt is displayed only once, untill the prompt is closed, ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                            workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(resource)))
                                .returns(() => TypeMoq.Mock.ofType().object)
                                .verifiable(TypeMoq.Times.exactly(resource ? 5 : 0));
                            app.setup(a => a.showErrorMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                                .returns(() => promptDeferred.promise)
                                .verifiable(TypeMoq.Times.once());
                            // Display first prompt.
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            // Display a few more prompts.
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            app.verifyAll();
                            workspaceService.verifyAll();
                        }));
                        test(`Ensure the prompt is displayed again when previous prompt has been closed, ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                            workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(resource)))
                                .returns(() => TypeMoq.Mock.ofType().object)
                                .verifiable(TypeMoq.Times.exactly(resource ? 3 : 0));
                            app.setup(a => a.showErrorMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                                .returns(() => Promise.resolve(undefined))
                                .verifiable(TypeMoq.Times.exactly(3));
                            yield installer.promptToInstall(product.value, resource);
                            yield installer.promptToInstall(product.value, resource);
                            yield installer.promptToInstall(product.value, resource);
                            app.verifyAll();
                            workspaceService.verifyAll();
                        }));
                    }
                }
            }
        });
    });
});
//# sourceMappingURL=installer.unit.test.js.map