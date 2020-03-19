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
const constants_2 = require("../../../client/unittests/common/constants");
const types_2 = require("../../../client/unittests/common/types");
const common_1 = require("../../common");
const serviceRegistry_1 = require("../serviceRegistry");
const initialize_1 = require("./../../initialize");
const testFilesPath = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles');
const UNITTEST_TEST_FILES_PATH = path.join(testFilesPath, 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(testFilesPath, 'single');
const unitTestTestFilesCwdPath = path.join(testFilesPath, 'cwd', 'src');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - unittest - discovery with mocked process output', () => {
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
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield common_1.updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, common_1.rootWorkspaceUri, configTarget);
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();
        // Mocks.
        ioc.registerMockProcessTypes();
    }
    function injectTestDiscoveryOutput(output) {
        return __awaiter(this, void 0, void 0, function* () {
            const procService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory).create();
            procService.onExecObservable((file, args, options, callback) => {
                if (args.length > 1 && args[0] === '-c' && args[1].includes('import unittest') && args[1].includes('loader = unittest.TestLoader()')) {
                    callback({
                        // Ensure any spaces added during code formatting or the like are removed.
                        out: output.split(/\r?\n/g).map(item => item.trim()).join(os_1.EOL),
                        source: 'stdout'
                    });
                }
            });
        });
    }
    test('Discover Tests (single test file)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`start
    test_one.Test_test1.test_A
    test_one.Test_test1.test_B
    test_one.Test_test1.test_c
    `);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_one.py' && t.nameToRun === 'test_one.Test_test1.test_A'), true, 'Test File not found');
    }));
    test('Discover Tests', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
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
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, rootDirectory);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 9, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 3, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_unittest_one.py' && t.nameToRun === 'test_unittest_one.Test_test1.test_A'), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_unittest_two.py' && t.nameToRun === 'test_unittest_two.Test_test2.test_A2'), true, 'Test File not found');
    }));
    test('Discover Tests (pattern = *_test_*.py)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=*_test*.py'], common_1.rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`start
    unittest_three_test.Test_test3.test_A
    unittest_three_test.Test_test3.test_B
    `);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, rootDirectory);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'unittest_three_test.py' && t.nameToRun === 'unittest_three_test.Test_test3.test_A'), true, 'Test File not found');
    }));
    test('Setting cwd should return tests', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`start
    test_cwd.Test_Current_Working_Directory.test_cwd
    `);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, unitTestTestFilesCwdPath);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 1, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
    }));
});
//# sourceMappingURL=unittest.discovery.test.js.map