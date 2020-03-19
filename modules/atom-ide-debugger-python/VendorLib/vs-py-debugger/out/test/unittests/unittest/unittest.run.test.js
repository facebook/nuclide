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
const assert = require("assert");
const fs = require("fs-extra");
const os_1 = require("os");
const path = require("path");
const vscode_1 = require("vscode");
const constants_1 = require("../../../client/common/constants");
const types_1 = require("../../../client/common/process/types");
const argumentsHelper_1 = require("../../../client/unittests/common/argumentsHelper");
const constants_2 = require("../../../client/unittests/common/constants");
const runner_1 = require("../../../client/unittests/common/runner");
const types_2 = require("../../../client/unittests/common/types");
const types_3 = require("../../../client/unittests/types");
const helper_1 = require("../../../client/unittests/unittest/helper");
const runner_2 = require("../../../client/unittests/unittest/runner");
const argsService_1 = require("../../../client/unittests/unittest/services/argsService");
const common_1 = require("../../common");
const serviceRegistry_1 = require("../serviceRegistry");
const initialize_1 = require("./../../initialize");
const testFilesPath = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles');
const UNITTEST_TEST_FILES_PATH = path.join(testFilesPath, 'standard');
const unitTestSpecificTestFilesPath = path.join(testFilesPath, 'specificTest');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - unittest - run with mocked process output', () => {
    let ioc;
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    const configTarget = initialize_1.IS_MULTI_ROOT_TEST ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Workspace;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initialize();
        yield common_1.updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, common_1.rootWorkspaceUri, configTarget);
    }));
    setup(() => __awaiter(this, void 0, void 0, function* () {
        const cachePath = path.join(UNITTEST_TEST_FILES_PATH, '.cache');
        if (yield fs.pathExists(cachePath)) {
            yield fs.remove(cachePath);
        }
        yield initialize_1.initializeTest();
        initializeDI();
        yield ignoreTestLauncher();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield common_1.updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, common_1.rootWorkspaceUri, configTarget);
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        // Mocks.
        ioc.registerMockProcessTypes();
        ioc.registerMockUnitTestSocketServer();
        // Standard unit test stypes.
        ioc.registerTestDiscoveryServices();
        ioc.registerTestManagers();
        ioc.registerTestManagerService();
        ioc.registerTestParsers();
        ioc.registerTestResultsHelper();
        ioc.registerTestsHelper();
        ioc.registerTestStorage();
        ioc.registerTestVisitors();
        ioc.serviceManager.add(types_3.IArgumentsService, argsService_1.ArgumentsService, constants_2.UNITTEST_PROVIDER);
        ioc.serviceManager.add(types_3.IArgumentsHelper, argumentsHelper_1.ArgumentsHelper);
        ioc.serviceManager.add(types_3.ITestManagerRunner, runner_2.TestManagerRunner, constants_2.UNITTEST_PROVIDER);
        ioc.serviceManager.add(types_2.ITestRunner, runner_1.TestRunner);
        ioc.serviceManager.add(types_3.IUnitTestHelper, helper_1.UnitTestHelper);
    }
    function ignoreTestLauncher() {
        return __awaiter(this, void 0, void 0, function* () {
            const procService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory).create();
            // When running the python test launcher, just return.
            procService.onExecObservable((file, args, options, callback) => {
                if (args.length > 1 && args[0].endsWith('visualstudio_py_testlauncher.py')) {
                    callback({ out: '', source: 'stdout' });
                }
            });
        });
    }
    function injectTestDiscoveryOutput(output) {
        return __awaiter(this, void 0, void 0, function* () {
            const procService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory).create();
            procService.onExecObservable((file, args, options, callback) => {
                if (args.length > 1 && args[0] === '-c' && args[1].includes('import unittest') && args[1].includes('loader = unittest.TestLoader()')) {
                    callback({
                        // Ensure any spaces added during code formatting or the like are removed
                        out: output.split(/\r?\n/g).map(item => item.trim()).join(os_1.EOL),
                        source: 'stdout'
                    });
                }
            });
        });
    }
    function injectTestSocketServerResults(results) {
        // Add results to be sent by unit test socket server.
        const socketServer = ioc.serviceContainer.get(types_2.IUnitTestSocketServer);
        socketServer.reset();
        socketServer.addResults(results);
    }
    test('Run Tests', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-v', '-s', './tests', '-p', 'test_unittest*.py'], common_1.rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`start
        test_unittest_one.Test_test1.test_A
        test_unittest_one.Test_test1.test_B
        test_unittest_one.Test_test1.test_c
        test_unittest_two.Test_test2.test_A2
        test_unittest_two.Test_test2.test_B2
        test_unittest_two.Test_test2.test_C2
        test_unittest_two.Test_test2.test_D2
        test_unittest_two.Test_test2a.test_222A2
        test_unittest_two.Test_test2a.test_222B2
        `);
        const resultsToSend = [
            { outcome: 'failed', traceback: 'AssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_one.Test_test1.test_A' },
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_one.Test_test1.test_B' },
            { outcome: 'skipped', traceback: null, message: null, test: 'test_unittest_one.Test_test1.test_c' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_two.Test_test2.test_A2' },
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_two.Test_test2.test_B2' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: 1 != 2 : Not equal\n', message: '1 != 2 : Not equal', test: 'test_unittest_two.Test_test2.test_C2' },
            { outcome: 'error', traceback: 'raise ArithmeticError()\nArithmeticError\n', message: '', test: 'test_unittest_two.Test_test2.test_D2' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_two.Test_test2a.test_222A2' },
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_two.Test_test2a.test_222B2' }
        ];
        injectTestSocketServerResults(resultsToSend);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, rootDirectory);
        const results = yield testManager.runTest(constants_2.CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 4, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    }));
    test('Run Failed Tests', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_unittest*.py'], common_1.rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`start
            test_unittest_one.Test_test1.test_A
            test_unittest_one.Test_test1.test_B
            test_unittest_one.Test_test1.test_c
            test_unittest_two.Test_test2.test_A2
            test_unittest_two.Test_test2.test_B2
            test_unittest_two.Test_test2.test_C2
            test_unittest_two.Test_test2.test_D2
            test_unittest_two.Test_test2a.test_222A2
            test_unittest_two.Test_test2a.test_222B2
            `);
        const resultsToSend = [
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_one.Test_test1.test_A' },
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_one.Test_test1.test_B' },
            { outcome: 'skipped', traceback: null, message: null, test: 'test_unittest_one.Test_test1.test_c' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_two.Test_test2.test_A2' },
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_two.Test_test2.test_B2' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: 1 != 2 : Not equal\n', message: '1 != 2 : Not equal', test: 'test_unittest_two.Test_test2.test_C2' },
            { outcome: 'error', traceback: 'raise ArithmeticError()\nArithmeticError\n', message: '', test: 'test_unittest_two.Test_test2.test_D2' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_two.Test_test2a.test_222A2' },
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_two.Test_test2a.test_222B2' }
        ];
        injectTestSocketServerResults(resultsToSend);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, rootDirectory);
        let results = yield testManager.runTest(constants_2.CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 4, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
        const failedResultsToSend = [
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_one.Test_test1.test_A' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_two.Test_test2.test_A2' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: 1 != 2 : Not equal\n', message: '1 != 2 : Not equal', test: 'test_unittest_two.Test_test2.test_C2' },
            { outcome: 'error', traceback: 'raise ArithmeticError()\nArithmeticError\n', message: '', test: 'test_unittest_two.Test_test2.test_D2' },
            { outcome: 'failed', traceback: 'raise self.failureException(msg)\nAssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_two.Test_test2a.test_222A2' }
        ];
        injectTestSocketServerResults(failedResultsToSend);
        results = yield testManager.runTest(constants_2.CommandSource.ui, undefined, true);
        assert.equal(results.summary.errors, 1, 'Failed Errors');
        assert.equal(results.summary.failures, 4, 'Failed Failures');
        assert.equal(results.summary.passed, 0, 'Failed Passed');
        assert.equal(results.summary.skipped, 0, 'Failed skipped');
    }));
    test('Run Specific Test File', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_unittest*.py'], common_1.rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`start
        test_unittest_one.Test_test_one_1.test_1_1_1
        test_unittest_one.Test_test_one_1.test_1_1_2
        test_unittest_one.Test_test_one_1.test_1_1_3
        test_unittest_one.Test_test_one_2.test_1_2_1
        test_unittest_two.Test_test_two_1.test_1_1_1
        test_unittest_two.Test_test_two_1.test_1_1_2
        test_unittest_two.Test_test_two_1.test_1_1_3
        test_unittest_two.Test_test_two_2.test_2_1_1
        `);
        const resultsToSend = [
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_one.Test_test_one_1.test_1_1_1' },
            { outcome: 'failed', traceback: 'AssertionError: 1 != 2 : Not equal\n', message: '1 != 2 : Not equal', test: 'test_unittest_one.Test_test_one_1.test_1_1_2' },
            { outcome: 'skipped', traceback: null, message: null, test: 'test_unittest_one.Test_test_one_1.test_1_1_3' },
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_one.Test_test_one_2.test_1_2_1' }
        ];
        injectTestSocketServerResults(resultsToSend);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, unitTestSpecificTestFilesPath);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        // tslint:disable-next-line:no-non-null-assertion
        const testFileToTest = tests.testFiles.find(f => f.name === 'test_unittest_one.py');
        const testFile = { testFile: [testFileToTest], testFolder: [], testFunction: [], testSuite: [] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testFile);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 2, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    }));
    test('Run Specific Test Suite', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_unittest*.py'], common_1.rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`start
        test_unittest_one.Test_test_one_1.test_1_1_1
        test_unittest_one.Test_test_one_1.test_1_1_2
        test_unittest_one.Test_test_one_1.test_1_1_3
        test_unittest_one.Test_test_one_2.test_1_2_1
        test_unittest_two.Test_test_two_1.test_1_1_1
        test_unittest_two.Test_test_two_1.test_1_1_2
        test_unittest_two.Test_test_two_1.test_1_1_3
        test_unittest_two.Test_test_two_2.test_2_1_1
        `);
        const resultsToSend = [
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_one.Test_test_one_1.test_1_1_1' },
            { outcome: 'failed', traceback: 'AssertionError: 1 != 2 : Not equal\n', message: '1 != 2 : Not equal', test: 'test_unittest_one.Test_test_one_1.test_1_1_2' },
            { outcome: 'skipped', traceback: null, message: null, test: 'test_unittest_one.Test_test_one_1.test_1_1_3' },
            { outcome: 'passed', traceback: null, message: null, test: 'test_unittest_one.Test_test_one_2.test_1_2_1' }
        ];
        injectTestSocketServerResults(resultsToSend);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, unitTestSpecificTestFilesPath);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        // tslint:disable-next-line:no-non-null-assertion
        const testSuiteToTest = tests.testSuites.find(s => s.testSuite.name === 'Test_test_one_1').testSuite;
        const testSuite = { testFile: [], testFolder: [], testFunction: [], testSuite: [testSuiteToTest] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 2, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    }));
    test('Run Specific Test Function', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_unittest*.py'], common_1.rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`start
        test_unittest_one.Test_test1.test_A
        test_unittest_one.Test_test1.test_B
        test_unittest_one.Test_test1.test_c
        test_unittest_two.Test_test2.test_A2
        test_unittest_two.Test_test2.test_B2
        test_unittest_two.Test_test2.test_C2
        test_unittest_two.Test_test2.test_D2
        test_unittest_two.Test_test2a.test_222A2
        test_unittest_two.Test_test2a.test_222B2
        `);
        const resultsToSend = [
            { outcome: 'failed', traceback: 'AssertionError: Not implemented\n', message: 'Not implemented', test: 'test_unittest_one.Test_test1.test_A' }
        ];
        injectTestSocketServerResults(resultsToSend);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, rootDirectory);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        const testFn = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    }));
});
//# sourceMappingURL=unittest.run.test.js.map