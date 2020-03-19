"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../common/types");
const interpreterComparer_1 = require("./configuration/interpreterComparer");
const interpreterSelector_1 = require("./configuration/interpreterSelector");
const pythonPathUpdaterService_1 = require("./configuration/pythonPathUpdaterService");
const pythonPathUpdaterServiceFactory_1 = require("./configuration/pythonPathUpdaterServiceFactory");
const types_2 = require("./configuration/types");
const contracts_1 = require("./contracts");
const display_1 = require("./display");
const progressDisplay_1 = require("./display/progressDisplay");
const shebangCodeLensProvider_1 = require("./display/shebangCodeLensProvider");
const helpers_1 = require("./helpers");
const interpreterService_1 = require("./interpreterService");
const interpreterVersion_1 = require("./interpreterVersion");
const helpers_2 = require("./locators/helpers");
const index_1 = require("./locators/index");
const progressService_1 = require("./locators/progressService");
const condaEnvFileService_1 = require("./locators/services/condaEnvFileService");
const condaEnvService_1 = require("./locators/services/condaEnvService");
const condaService_1 = require("./locators/services/condaService");
const currentPathService_1 = require("./locators/services/currentPathService");
const globalVirtualEnvService_1 = require("./locators/services/globalVirtualEnvService");
const interpreterWatcherBuilder_1 = require("./locators/services/interpreterWatcherBuilder");
const KnownPathsService_1 = require("./locators/services/KnownPathsService");
const pipEnvService_1 = require("./locators/services/pipEnvService");
const windowsRegistryService_1 = require("./locators/services/windowsRegistryService");
const workspaceVirtualEnvService_1 = require("./locators/services/workspaceVirtualEnvService");
const workspaceVirtualEnvWatcherService_1 = require("./locators/services/workspaceVirtualEnvWatcherService");
const index_2 = require("./virtualEnvs/index");
const types_3 = require("./virtualEnvs/types");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(contracts_1.IKnownSearchPathsForInterpreters, KnownPathsService_1.KnownSearchPathsForInterpreters);
    serviceManager.addSingleton(contracts_1.IVirtualEnvironmentsSearchPathProvider, globalVirtualEnvService_1.GlobalVirtualEnvironmentsSearchPathProvider, 'global');
    serviceManager.addSingleton(contracts_1.IVirtualEnvironmentsSearchPathProvider, workspaceVirtualEnvService_1.WorkspaceVirtualEnvironmentsSearchPathProvider, 'workspace');
    serviceManager.addSingleton(contracts_1.ICondaService, condaService_1.CondaService);
    serviceManager.addSingleton(types_3.IVirtualEnvironmentManager, index_2.VirtualEnvironmentManager);
    serviceManager.add(contracts_1.IInterpreterWatcher, workspaceVirtualEnvWatcherService_1.WorkspaceVirtualEnvWatcherService, contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE);
    serviceManager.addSingleton(contracts_1.IInterpreterWatcherBuilder, interpreterWatcherBuilder_1.InterpreterWatcherBuilder);
    serviceManager.addSingleton(contracts_1.IInterpreterVersionService, interpreterVersion_1.InterpreterVersionService);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, index_1.PythonInterpreterLocatorService, contracts_1.INTERPRETER_LOCATOR_SERVICE);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, condaEnvFileService_1.CondaEnvFileService, contracts_1.CONDA_ENV_FILE_SERVICE);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, condaEnvService_1.CondaEnvService, contracts_1.CONDA_ENV_SERVICE);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, currentPathService_1.CurrentPathService, contracts_1.CURRENT_PATH_SERVICE);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, globalVirtualEnvService_1.GlobalVirtualEnvService, contracts_1.GLOBAL_VIRTUAL_ENV_SERVICE);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, workspaceVirtualEnvService_1.WorkspaceVirtualEnvService, contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, pipEnvService_1.PipEnvService, contracts_1.PIPENV_SERVICE);
    serviceManager.addSingleton(contracts_1.IPipEnvService, pipEnvService_1.PipEnvService);
    const isWindows = serviceManager.get(types_1.IsWindows);
    if (isWindows) {
        serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, windowsRegistryService_1.WindowsRegistryService, contracts_1.WINDOWS_REGISTRY_SERVICE);
    }
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorService, KnownPathsService_1.KnownPathsService, contracts_1.KNOWN_PATH_SERVICE);
    serviceManager.addSingleton(contracts_1.IInterpreterService, interpreterService_1.InterpreterService);
    serviceManager.addSingleton(contracts_1.IInterpreterDisplay, display_1.InterpreterDisplay);
    serviceManager.addSingleton(types_2.IPythonPathUpdaterServiceFactory, pythonPathUpdaterServiceFactory_1.PythonPathUpdaterServiceFactory);
    serviceManager.addSingleton(types_2.IPythonPathUpdaterServiceManager, pythonPathUpdaterService_1.PythonPathUpdaterService);
    serviceManager.addSingleton(types_2.IInterpreterSelector, interpreterSelector_1.InterpreterSelector);
    serviceManager.addSingleton(contracts_1.IShebangCodeLensProvider, shebangCodeLensProvider_1.ShebangCodeLensProvider);
    serviceManager.addSingleton(contracts_1.IInterpreterHelper, helpers_1.InterpreterHelper);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorHelper, helpers_2.InterpreterLocatorHelper);
    serviceManager.addSingleton(types_2.IInterpreterComparer, interpreterComparer_1.InterpreterComparer);
    serviceManager.addSingleton(contracts_1.InterpreterLocatorProgressHandler, progressDisplay_1.InterpreterLocatorProgressStatubarHandler);
    serviceManager.addSingleton(contracts_1.IInterpreterLocatorProgressService, progressService_1.InterpreterLocatorProgressService);
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map