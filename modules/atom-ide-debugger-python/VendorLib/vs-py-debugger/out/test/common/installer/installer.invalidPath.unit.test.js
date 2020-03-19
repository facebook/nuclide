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
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/application/types");
require("../../../client/common/extensions");
const productInstaller_1 = require("../../../client/common/installer/productInstaller");
const productService_1 = require("../../../client/common/installer/productService");
const types_2 = require("../../../client/common/installer/types");
const types_3 = require("../../../client/common/types");
const enum_1 = require("../../../client/common/utils/enum");
chai_1.use(chaiAsPromised);
suite('Module Installer - Invalid Paths', () => {
    [undefined, vscode_1.Uri.file('resource')].forEach(resource => {
        ['moduleName', path.join('users', 'dev', 'tool', 'executable')].forEach(pathToExecutable => {
            const isExecutableAModule = path.basename(pathToExecutable) === pathToExecutable;
            enum_1.getNamesAndValues(types_3.Product).forEach(product => {
                let installer;
                let serviceContainer;
                let app;
                let workspaceService;
                let productPathService;
                setup(() => {
                    serviceContainer = TypeMoq.Mock.ofType();
                    const outputChannel = TypeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IProductService), TypeMoq.It.isAny())).returns(() => new productService_1.ProductService());
                    app = TypeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IApplicationShell), TypeMoq.It.isAny())).returns(() => app.object);
                    workspaceService = TypeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService), TypeMoq.It.isAny())).returns(() => workspaceService.object);
                    productPathService = TypeMoq.Mock.ofType();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IProductPathService), TypeMoq.It.isAny())).returns(() => productPathService.object);
                    installer = new productInstaller_1.ProductInstaller(serviceContainer.object, outputChannel.object);
                });
                switch (product.value) {
                    case types_3.Product.isort:
                    case types_3.Product.ctags:
                    case types_3.Product.rope:
                    case types_3.Product.unittest: {
                        return;
                    }
                    default: {
                        test(`Ensure invalid path message is ${isExecutableAModule ? 'not displayed' : 'displayed'} ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, () => __awaiter(this, void 0, void 0, function* () {
                            // If the path to executable is a module, then we won't display error message indicating path is invalid.
                            productPathService
                                .setup(p => p.getExecutableNameFromSettings(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource)))
                                .returns(() => pathToExecutable)
                                .verifiable(TypeMoq.Times.atLeast(isExecutableAModule ? 0 : 1));
                            productPathService
                                .setup(p => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource)))
                                .returns(() => isExecutableAModule)
                                .verifiable(TypeMoq.Times.atLeastOnce());
                            const anyParams = [0, 1, 2, 3, 4, 5].map(() => TypeMoq.It.isAny());
                            app.setup(a => a.showErrorMessage(TypeMoq.It.isAny(), ...anyParams))
                                .callback(message => {
                                if (!isExecutableAModule) {
                                    chai_1.expect(message).contains(pathToExecutable);
                                }
                            })
                                .returns(() => Promise.resolve(undefined))
                                .verifiable(TypeMoq.Times.exactly(1));
                            yield installer.promptToInstall(product.value, resource);
                            productPathService.verifyAll();
                        }));
                    }
                }
            });
        });
    });
});
//# sourceMappingURL=installer.invalidPath.unit.test.js.map