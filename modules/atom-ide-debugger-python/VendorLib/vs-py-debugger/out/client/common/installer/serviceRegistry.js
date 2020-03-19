// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../application/types");
const webPanelProvider_1 = require("../application/webPanelProvider");
const types_2 = require("../types");
const channelManager_1 = require("./channelManager");
const condaInstaller_1 = require("./condaInstaller");
const pipEnvInstaller_1 = require("./pipEnvInstaller");
const pipInstaller_1 = require("./pipInstaller");
const productPath_1 = require("./productPath");
const productService_1 = require("./productService");
const types_3 = require("./types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_3.IModuleInstaller, condaInstaller_1.CondaInstaller);
    serviceManager.addSingleton(types_3.IModuleInstaller, pipInstaller_1.PipInstaller);
    serviceManager.addSingleton(types_3.IModuleInstaller, pipEnvInstaller_1.PipEnvInstaller);
    serviceManager.addSingleton(types_3.IInstallationChannelManager, channelManager_1.InstallationChannelManager);
    serviceManager.addSingleton(types_3.IProductService, productService_1.ProductService);
    serviceManager.addSingleton(types_3.IProductPathService, productPath_1.CTagsProductPathService, types_2.ProductType.WorkspaceSymbols);
    serviceManager.addSingleton(types_3.IProductPathService, productPath_1.FormatterProductPathService, types_2.ProductType.Formatter);
    serviceManager.addSingleton(types_3.IProductPathService, productPath_1.LinterProductPathService, types_2.ProductType.Linter);
    serviceManager.addSingleton(types_3.IProductPathService, productPath_1.TestFrameworkProductPathService, types_2.ProductType.TestFramework);
    serviceManager.addSingleton(types_3.IProductPathService, productPath_1.RefactoringLibraryProductPathService, types_2.ProductType.RefactoringLibrary);
    serviceManager.addSingleton(types_1.IWebPanelProvider, webPanelProvider_1.WebPanelProvider);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map