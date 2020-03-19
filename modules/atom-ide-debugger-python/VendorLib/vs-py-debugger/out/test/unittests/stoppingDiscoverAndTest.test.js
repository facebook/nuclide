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
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/types");
const async_1 = require("../../client/common/utils/async");
const constants_1 = require("../../client/unittests/common/constants");
const types_2 = require("../../client/unittests/common/types");
const initialize_1 = require("../initialize");
const mocks_1 = require("./mocks");
const serviceRegistry_1 = require("./serviceRegistry");
chai_1.use(chaiAsPromised);
const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
// tslint:disable-next-line:variable-name
const EmptyTests = {
    summary: {
        passed: 0,
        failures: 0,
        errors: 0,
        skipped: 0
    },
    testFiles: [],
    testFunctions: [],
    testSuites: [],
    testFolders: [],
    rootTestFolders: []
};
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Stopping Discovery and Runner', () => {
    let ioc;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initializeTest();
        initializeDI();
    }));
    teardown(() => ioc.dispose());
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerTestParsers();
        ioc.registerTestVisitors();
        ioc.registerTestResultsHelper();
        ioc.registerTestStorage();
        ioc.registerTestsHelper();
    }
    test('Running tests should not stop existing discovery', () => __awaiter(this, void 0, void 0, function* () {
        const mockTestManager = new mocks_1.MockTestManagerWithRunningTests(constants_1.UNITTEST_PROVIDER, types_1.Product.unittest, vscode_1.Uri.file(testFilesPath), testFilesPath, ioc.serviceContainer);
        ioc.serviceManager.addSingletonInstance(types_2.ITestDiscoveryService, new mocks_1.MockDiscoveryService(mockTestManager.discoveryDeferred.promise), constants_1.UNITTEST_PROVIDER);
        const discoveryPromise = mockTestManager.discoverTests(constants_1.CommandSource.auto);
        mockTestManager.discoveryDeferred.resolve(EmptyTests);
        const runningPromise = mockTestManager.runTest(constants_1.CommandSource.ui);
        const deferred = async_1.createDeferred();
        // This promise should never resolve nor reject.
        runningPromise
            .then(() => Promise.reject('Debugger stopped when it shouldn\'t have'))
            .catch(error => deferred.reject(error));
        discoveryPromise.then(result => {
            if (result === EmptyTests) {
                deferred.resolve('');
            }
            else {
                deferred.reject('tests not empty');
            }
        }).catch(error => deferred.reject(error));
        yield deferred.promise;
    }));
    test('Discovering tests should stop running tests', () => __awaiter(this, void 0, void 0, function* () {
        const mockTestManager = new mocks_1.MockTestManagerWithRunningTests(constants_1.UNITTEST_PROVIDER, types_1.Product.unittest, vscode_1.Uri.file(testFilesPath), testFilesPath, ioc.serviceContainer);
        ioc.serviceManager.addSingletonInstance(types_2.ITestDiscoveryService, new mocks_1.MockDiscoveryService(mockTestManager.discoveryDeferred.promise), constants_1.UNITTEST_PROVIDER);
        mockTestManager.discoveryDeferred.resolve(EmptyTests);
        yield mockTestManager.discoverTests(constants_1.CommandSource.auto);
        const runPromise = mockTestManager.runTest(constants_1.CommandSource.ui);
        // tslint:disable-next-line:no-string-based-set-timeout
        yield new Promise(resolve => setTimeout(resolve, 1000));
        // User manually discovering tests will kill the existing test runner.
        yield mockTestManager.discoverTests(constants_1.CommandSource.ui, true, false, true);
        yield chai_1.expect(runPromise).to.eventually.be.rejectedWith(constants_1.CANCELLATION_REASON);
    }));
});
//# sourceMappingURL=stoppingDiscoverAndTest.test.js.map