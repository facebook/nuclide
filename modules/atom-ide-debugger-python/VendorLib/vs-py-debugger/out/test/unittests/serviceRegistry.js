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
const types_1 = require("../../client/common/process/types");
const codeCssGenerator_1 = require("../../client/datascience/codeCssGenerator");
const history_1 = require("../../client/datascience/history");
const historyProvider_1 = require("../../client/datascience/historyProvider");
const jupyterExecution_1 = require("../../client/datascience/jupyterExecution");
const jupyterImporter_1 = require("../../client/datascience/jupyterImporter");
const jupyterServer_1 = require("../../client/datascience/jupyterServer");
const types_2 = require("../../client/datascience/types");
const types_3 = require("../../client/ioc/types");
const constants_1 = require("../../client/unittests/common/constants");
const storageService_1 = require("../../client/unittests/common/services/storageService");
const testManagerService_1 = require("../../client/unittests/common/services/testManagerService");
const testResultsService_1 = require("../../client/unittests/common/services/testResultsService");
const testUtils_1 = require("../../client/unittests/common/testUtils");
const flatteningVisitor_1 = require("../../client/unittests/common/testVisitors/flatteningVisitor");
const folderGenerationVisitor_1 = require("../../client/unittests/common/testVisitors/folderGenerationVisitor");
const resultResetVisitor_1 = require("../../client/unittests/common/testVisitors/resultResetVisitor");
const types_4 = require("../../client/unittests/common/types");
const main_1 = require("../../client/unittests/nosetest/main");
const discoveryService_1 = require("../../client/unittests/nosetest/services/discoveryService");
const parserService_1 = require("../../client/unittests/nosetest/services/parserService");
const main_2 = require("../../client/unittests/pytest/main");
const discoveryService_2 = require("../../client/unittests/pytest/services/discoveryService");
const parserService_2 = require("../../client/unittests/pytest/services/parserService");
const main_3 = require("../../client/unittests/unittest/main");
const discoveryService_3 = require("../../client/unittests/unittest/services/discoveryService");
const parserService_3 = require("../../client/unittests/unittest/services/parserService");
const common_1 = require("../common");
const serviceRegistry_1 = require("../serviceRegistry");
const mocks_1 = require("./mocks");
class UnitTestIocContainer extends serviceRegistry_1.IocContainer {
    constructor() {
        super();
    }
    getPythonMajorVersion(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const procServiceFactory = this.serviceContainer.get(types_1.IProcessServiceFactory);
            const procService = yield procServiceFactory.create(resource);
            const pythonVersion = yield common_1.getPythonSemVer(procService);
            if (pythonVersion) {
                return pythonVersion.major;
            }
            else {
                return -1; // log warning already issued by underlying functions...
            }
        });
    }
    registerTestVisitors() {
        this.serviceManager.add(types_4.ITestVisitor, flatteningVisitor_1.TestFlatteningVisitor, 'TestFlatteningVisitor');
        this.serviceManager.add(types_4.ITestVisitor, folderGenerationVisitor_1.TestFolderGenerationVisitor, 'TestFolderGenerationVisitor');
        this.serviceManager.add(types_4.ITestVisitor, resultResetVisitor_1.TestResultResetVisitor, 'TestResultResetVisitor');
    }
    registerTestStorage() {
        this.serviceManager.addSingleton(types_4.ITestCollectionStorageService, storageService_1.TestCollectionStorageService);
    }
    registerTestsHelper() {
        this.serviceManager.addSingleton(types_4.ITestsHelper, testUtils_1.TestsHelper);
    }
    registerTestResultsHelper() {
        this.serviceManager.add(types_4.ITestResultsService, testResultsService_1.TestResultsService);
    }
    registerTestParsers() {
        this.serviceManager.add(types_4.ITestsParser, parserService_3.TestsParser, constants_1.UNITTEST_PROVIDER);
        this.serviceManager.add(types_4.ITestsParser, parserService_2.TestsParser, constants_1.PYTEST_PROVIDER);
        this.serviceManager.add(types_4.ITestsParser, parserService_1.TestsParser, constants_1.NOSETEST_PROVIDER);
    }
    registerTestDiscoveryServices() {
        this.serviceManager.add(types_4.ITestDiscoveryService, discoveryService_3.TestDiscoveryService, constants_1.UNITTEST_PROVIDER);
        this.serviceManager.add(types_4.ITestDiscoveryService, discoveryService_2.TestDiscoveryService, constants_1.PYTEST_PROVIDER);
        this.serviceManager.add(types_4.ITestDiscoveryService, discoveryService_1.TestDiscoveryService, constants_1.NOSETEST_PROVIDER);
    }
    registerTestManagers() {
        this.serviceManager.addFactory(types_4.ITestManagerFactory, (context) => {
            return (testProvider, workspaceFolder, rootDirectory) => {
                const serviceContainer = context.container.get(types_3.IServiceContainer);
                switch (testProvider) {
                    case constants_1.NOSETEST_PROVIDER: {
                        return new main_1.TestManager(workspaceFolder, rootDirectory, serviceContainer);
                    }
                    case constants_1.PYTEST_PROVIDER: {
                        return new main_2.TestManager(workspaceFolder, rootDirectory, serviceContainer);
                    }
                    case constants_1.UNITTEST_PROVIDER: {
                        return new main_3.TestManager(workspaceFolder, rootDirectory, serviceContainer);
                    }
                    default: {
                        throw new Error(`Unrecognized test provider '${testProvider}'`);
                    }
                }
            };
        });
    }
    registerTestManagerService() {
        this.serviceManager.addFactory(types_4.ITestManagerServiceFactory, (context) => {
            return (workspaceFolder) => {
                const serviceContainer = context.container.get(types_3.IServiceContainer);
                const testsHelper = context.container.get(types_4.ITestsHelper);
                return new testManagerService_1.TestManagerService(workspaceFolder, testsHelper, serviceContainer);
            };
        });
    }
    registerMockUnitTestSocketServer() {
        this.serviceManager.addSingleton(types_4.IUnitTestSocketServer, mocks_1.MockUnitTestSocketServer);
    }
    registerDataScienceTypes() {
        this.serviceManager.addSingleton(types_2.IJupyterExecution, jupyterExecution_1.JupyterExecution);
        this.serviceManager.addSingleton(types_2.IHistoryProvider, historyProvider_1.HistoryProvider);
        this.serviceManager.add(types_2.IHistory, history_1.History);
        this.serviceManager.add(types_2.INotebookImporter, jupyterImporter_1.JupyterImporter);
        this.serviceManager.add(types_2.INotebookServer, jupyterServer_1.JupyterServer);
        this.serviceManager.addSingleton(types_2.ICodeCssGenerator, codeCssGenerator_1.CodeCssGenerator);
    }
}
exports.UnitTestIocContainer = UnitTestIocContainer;
//# sourceMappingURL=serviceRegistry.js.map