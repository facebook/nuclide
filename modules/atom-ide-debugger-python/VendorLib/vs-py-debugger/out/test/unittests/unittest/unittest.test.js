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
const assert = require("assert");
const fs = require("fs-extra");
const path = require("path");
const vscode_1 = require("vscode");
const constants_1 = require("../../../client/common/constants");
const platform_1 = require("../../../client/common/utils/platform");
const constants_2 = require("../../../client/unittests/common/constants");
const types_1 = require("../../../client/unittests/common/types");
const common_1 = require("../../common");
const serviceRegistry_1 = require("../serviceRegistry");
const initialize_1 = require("./../../initialize");
const testFilesPath = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles');
const UNITTEST_TEST_FILES_PATH = path.join(testFilesPath, 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(testFilesPath, 'single');
const UNITTEST_MULTI_TEST_FILE_PATH = path.join(testFilesPath, 'multi');
const UNITTEST_COUNTS_TEST_FILE_PATH = path.join(testFilesPath, 'counter');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - unittest - discovery against actual python process', () => {
    let ioc;
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
        ioc.registerProcessTypes();
    }
    test('Discover Tests (single test file)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_1.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_one.py' && t.nameToRun === 'test_one.Test_test1.test_A'), true, 'Test File not found');
    }));
    test('Discover Tests (many test files, subdir included)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_1.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, UNITTEST_MULTI_TEST_FILE_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 3, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 9, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 3, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_one.py' && t.nameToRun === 'test_one.Test_test1.test_A'), true, 'Test File one not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_two.py' && t.nameToRun === 'test_two.Test_test2.test_2A'), true, 'Test File two not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_three.py' && t.nameToRun === 'more_tests.test_three.Test_test3.test_3A'), true, 'Test File three not found');
    }));
    test('Run single test', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_1.ITestManagerFactory);
        const testManager = factory('unittest', common_1.rootWorkspaceUri, UNITTEST_MULTI_TEST_FILE_PATH);
        const testsDiscovered = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        const testFile = testsDiscovered.testFiles.find((value) => value.nameToRun.endsWith('_3A'));
        assert.notEqual(testFile, undefined, 'No test file suffixed with _3A in test files.');
        assert.equal(testFile.suites.length, 1, 'Expected only 1 test suite in test file three.');
        const testFunc = testFile.suites[0].functions.find((value) => value.name === 'test_3A');
        assert.notEqual(testFunc, undefined, 'No test in file test_three.py named test_3A');
        const testsToRun = {
            testFunction: [testFunc]
        };
        const testRunResult = yield testManager.runTest(constants_2.CommandSource.ui, testsToRun);
        assert.equal(testRunResult.summary.failures + testRunResult.summary.passed + testRunResult.summary.skipped, 1, 'Expected to see only 1 test run in the summary for tests run.');
        assert.equal(testRunResult.summary.errors, 0, 'Unexpected: Test file ran with errors.');
        assert.equal(testRunResult.summary.failures, 0, 'Unexpected: Test has failed during test run.');
        assert.equal(testRunResult.summary.passed, 1, `Only one test should have passed during our test run. Instead, ${testRunResult.summary.passed} passed.`);
        assert.equal(testRunResult.summary.skipped, 0, `Expected to have skipped 0 tests during this test-run. Instead, ${testRunResult.summary.skipped} where skipped.`);
    }));
    test('Ensure correct test count for running a set of tests multiple times', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 3.4 under
            // Windows and macOS.Tracked by #2548.
            if (common_1.isOs(platform_1.OSType.Windows, platform_1.OSType.OSX)) {
                if (yield common_1.isPythonVersion('3.4')) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            }
            yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
            const factory = ioc.serviceContainer.get(types_1.ITestManagerFactory);
            const testManager = factory('unittest', common_1.rootWorkspaceUri, UNITTEST_COUNTS_TEST_FILE_PATH);
            const testsDiscovered = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
            const testsFile = testsDiscovered.testFiles.find((value) => value.name.startsWith('test_unit_test_counter'));
            assert.notEqual(testsFile, undefined, `No test file suffixed with _counter in test files. Looked in ${UNITTEST_COUNTS_TEST_FILE_PATH}.`);
            assert.equal(testsFile.suites.length, 1, 'Expected only 1 test suite in counter test file.');
            const testsToRun = {
                testFolder: [testsDiscovered.testFolders[0]]
            };
            // ensure that each re-run of the unit tests in question result in the same summary count information.
            let testRunResult = yield testManager.runTest(constants_2.CommandSource.ui, testsToRun);
            assert.equal(testRunResult.summary.failures, 2, 'This test was written assuming there was 2 tests run that would fail. (iteration 1)');
            assert.equal(testRunResult.summary.passed, 2, 'This test was written assuming there was 2 tests run that would succeed. (iteration 1)');
            testRunResult = yield testManager.runTest(constants_2.CommandSource.ui, testsToRun);
            assert.equal(testRunResult.summary.failures, 2, 'This test was written assuming there was 2 tests run that would fail. (iteration 2)');
            assert.equal(testRunResult.summary.passed, 2, 'This test was written assuming there was 2 tests run that would succeed. (iteration 2)');
        });
    });
    test('Re-run failed tests results in the correct number of tests counted', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 3.4 under
            // Windows and macOS.Tracked by #2548.
            if (common_1.isOs(platform_1.OSType.Windows, platform_1.OSType.OSX)) {
                if (yield common_1.isPythonVersion('3.4')) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            }
            yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
            const factory = ioc.serviceContainer.get(types_1.ITestManagerFactory);
            const testManager = factory('unittest', common_1.rootWorkspaceUri, UNITTEST_COUNTS_TEST_FILE_PATH);
            const testsDiscovered = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
            const testsFile = testsDiscovered.testFiles.find((value) => value.name.startsWith('test_unit_test_counter'));
            assert.notEqual(testsFile, undefined, `No test file suffixed with _counter in test files. Looked in ${UNITTEST_COUNTS_TEST_FILE_PATH}.`);
            assert.equal(testsFile.suites.length, 1, 'Expected only 1 test suite in counter test file.');
            const testsToRun = {
                testFolder: [testsDiscovered.testFolders[0]]
            };
            // ensure that each re-run of the unit tests in question result in the same summary count information.
            let testRunResult = yield testManager.runTest(constants_2.CommandSource.ui, testsToRun);
            assert.equal(testRunResult.summary.failures, 2, 'This test was written assuming there was 2 tests run that would fail. (iteration 1)');
            assert.equal(testRunResult.summary.passed, 2, 'This test was written assuming there was 2 tests run that would succeed. (iteration 1)');
            testRunResult = yield testManager.runTest(constants_2.CommandSource.ui, testsToRun, true);
            assert.equal(testRunResult.summary.failures, 2, 'This test was written assuming there was 2 tests run that would fail. (iteration 2)');
        });
    });
});
//# sourceMappingURL=unittest.test.js.map