"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../ioc/types");
const argumentsHelper_1 = require("./common/argumentsHelper");
const constants_1 = require("./common/constants");
const debugLauncher_1 = require("./common/debugLauncher");
const runner_1 = require("./common/runner");
const configSettingService_1 = require("./common/services/configSettingService");
const storageService_1 = require("./common/services/storageService");
const testManagerService_1 = require("./common/services/testManagerService");
const testResultsService_1 = require("./common/services/testResultsService");
const workspaceTestManagerService_1 = require("./common/services/workspaceTestManagerService");
const testUtils_1 = require("./common/testUtils");
const flatteningVisitor_1 = require("./common/testVisitors/flatteningVisitor");
const folderGenerationVisitor_1 = require("./common/testVisitors/folderGenerationVisitor");
const resultResetVisitor_1 = require("./common/testVisitors/resultResetVisitor");
const types_2 = require("./common/types");
const xUnitParser_1 = require("./common/xUnitParser");
const configuration_1 = require("./configuration");
const configurationFactory_1 = require("./configurationFactory");
const main_1 = require("./display/main");
const picker_1 = require("./display/picker");
const main_2 = require("./main");
const main_3 = require("./nosetest/main");
const runner_2 = require("./nosetest/runner");
const argsService_1 = require("./nosetest/services/argsService");
const discoveryService_1 = require("./nosetest/services/discoveryService");
const parserService_1 = require("./nosetest/services/parserService");
const main_4 = require("./pytest/main");
const runner_3 = require("./pytest/runner");
const argsService_2 = require("./pytest/services/argsService");
const discoveryService_2 = require("./pytest/services/discoveryService");
const parserService_2 = require("./pytest/services/parserService");
const types_3 = require("./types");
const helper_1 = require("./unittest/helper");
const main_5 = require("./unittest/main");
const runner_4 = require("./unittest/runner");
const argsService_3 = require("./unittest/services/argsService");
const discoveryService_3 = require("./unittest/services/discoveryService");
const parserService_3 = require("./unittest/services/parserService");
const socketServer_1 = require("./unittest/socketServer");
function registerTypes(serviceManager) {
    serviceManager.addSingleton(types_2.ITestDebugLauncher, debugLauncher_1.DebugLauncher);
    serviceManager.addSingleton(types_2.ITestCollectionStorageService, storageService_1.TestCollectionStorageService);
    serviceManager.addSingleton(types_2.IWorkspaceTestManagerService, workspaceTestManagerService_1.WorkspaceTestManagerService);
    serviceManager.add(types_2.ITestsHelper, testUtils_1.TestsHelper);
    serviceManager.add(types_2.IUnitTestSocketServer, socketServer_1.UnitTestSocketServer);
    serviceManager.add(types_2.ITestResultsService, testResultsService_1.TestResultsService);
    serviceManager.add(types_2.ITestVisitor, flatteningVisitor_1.TestFlatteningVisitor, 'TestFlatteningVisitor');
    serviceManager.add(types_2.ITestVisitor, folderGenerationVisitor_1.TestFolderGenerationVisitor, 'TestFolderGenerationVisitor');
    serviceManager.add(types_2.ITestVisitor, resultResetVisitor_1.TestResultResetVisitor, 'TestResultResetVisitor');
    serviceManager.add(types_2.ITestsParser, parserService_3.TestsParser, constants_1.UNITTEST_PROVIDER);
    serviceManager.add(types_2.ITestsParser, parserService_2.TestsParser, constants_1.PYTEST_PROVIDER);
    serviceManager.add(types_2.ITestsParser, parserService_1.TestsParser, constants_1.NOSETEST_PROVIDER);
    serviceManager.add(types_2.ITestDiscoveryService, discoveryService_3.TestDiscoveryService, constants_1.UNITTEST_PROVIDER);
    serviceManager.add(types_2.ITestDiscoveryService, discoveryService_2.TestDiscoveryService, constants_1.PYTEST_PROVIDER);
    serviceManager.add(types_2.ITestDiscoveryService, discoveryService_1.TestDiscoveryService, constants_1.NOSETEST_PROVIDER);
    serviceManager.add(types_3.IArgumentsHelper, argumentsHelper_1.ArgumentsHelper);
    serviceManager.add(types_2.ITestRunner, runner_1.TestRunner);
    serviceManager.add(types_2.IXUnitParser, xUnitParser_1.XUnitParser);
    serviceManager.add(types_3.IUnitTestHelper, helper_1.UnitTestHelper);
    serviceManager.add(types_3.IArgumentsService, argsService_2.ArgumentsService, constants_1.PYTEST_PROVIDER);
    serviceManager.add(types_3.IArgumentsService, argsService_1.ArgumentsService, constants_1.NOSETEST_PROVIDER);
    serviceManager.add(types_3.IArgumentsService, argsService_3.ArgumentsService, constants_1.UNITTEST_PROVIDER);
    serviceManager.add(types_3.ITestManagerRunner, runner_3.TestManagerRunner, constants_1.PYTEST_PROVIDER);
    serviceManager.add(types_3.ITestManagerRunner, runner_2.TestManagerRunner, constants_1.NOSETEST_PROVIDER);
    serviceManager.add(types_3.ITestManagerRunner, runner_4.TestManagerRunner, constants_1.UNITTEST_PROVIDER);
    serviceManager.addSingleton(types_3.IUnitTestConfigurationService, configuration_1.UnitTestConfigurationService);
    serviceManager.addSingleton(types_3.IUnitTestManagementService, main_2.UnitTestManagementService);
    serviceManager.addSingleton(types_3.ITestResultDisplay, main_1.TestResultDisplay);
    serviceManager.addSingleton(types_3.ITestDisplay, picker_1.TestDisplay);
    serviceManager.addSingleton(types_2.ITestConfigSettingsService, configSettingService_1.TestConfigSettingsService);
    serviceManager.addSingleton(types_3.ITestConfigurationManagerFactory, configurationFactory_1.TestConfigurationManagerFactory);
    serviceManager.addFactory(types_2.ITestManagerFactory, (context) => {
        return (testProvider, workspaceFolder, rootDirectory) => {
            const serviceContainer = context.container.get(types_1.IServiceContainer);
            switch (testProvider) {
                case constants_1.NOSETEST_PROVIDER: {
                    return new main_3.TestManager(workspaceFolder, rootDirectory, serviceContainer);
                }
                case constants_1.PYTEST_PROVIDER: {
                    return new main_4.TestManager(workspaceFolder, rootDirectory, serviceContainer);
                }
                case constants_1.UNITTEST_PROVIDER: {
                    return new main_5.TestManager(workspaceFolder, rootDirectory, serviceContainer);
                }
                default: {
                    throw new Error(`Unrecognized test provider '${testProvider}'`);
                }
            }
        };
    });
    serviceManager.addFactory(types_2.ITestManagerServiceFactory, (context) => {
        return (workspaceFolder) => {
            const serviceContainer = context.container.get(types_1.IServiceContainer);
            const testsHelper = context.container.get(types_2.ITestsHelper);
            return new testManagerService_1.TestManagerService(workspaceFolder, testsHelper, serviceContainer);
        };
    });
}
exports.registerTypes = registerTypes;
//# sourceMappingURL=serviceRegistry.js.map