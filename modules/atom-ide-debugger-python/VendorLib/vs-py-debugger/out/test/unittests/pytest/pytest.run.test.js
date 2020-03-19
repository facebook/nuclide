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
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const constants_1 = require("../../../client/common/constants");
const types_1 = require("../../../client/common/process/types");
const constants_2 = require("../../../client/unittests/common/constants");
const types_2 = require("../../../client/unittests/common/types");
const common_1 = require("../../common");
const serviceRegistry_1 = require("../serviceRegistry");
const initialize_1 = require("./../../initialize");
const UNITTEST_TEST_FILES_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const PYTEST_RESULTS_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'pytestFiles', 'results');
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - pytest - run with mocked process output', () => {
    let ioc;
    const configTarget = initialize_1.IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initialize();
        yield common_1.updateSetting('unitTest.pyTestArgs', [], common_1.rootWorkspaceUri, configTarget);
    }));
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initializeTest();
        initializeDI();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield common_1.updateSetting('unitTest.pyTestArgs', [], common_1.rootWorkspaceUri, configTarget);
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        // Mocks.
        ioc.registerMockProcessTypes();
    }
    function injectTestDiscoveryOutput(outputFileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const procService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory).create();
            procService.onExecObservable((file, args, options, callback) => {
                if (args.indexOf('--collect-only') >= 0) {
                    callback({
                        out: fs.readFileSync(path.join(PYTEST_RESULTS_PATH, outputFileName), 'utf8').replace(/\/Users\/donjayamanne\/.vscode\/extensions\/pythonVSCode\/src\/test\/pythonFiles\/testFiles\/noseFiles/g, PYTEST_RESULTS_PATH),
                        source: 'stdout'
                    });
                }
            });
        });
    }
    function injectTestRunOutput(outputFileName, failedOutput = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const procService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory).create();
            procService.onExecObservable((file, args, options, callback) => {
                if (failedOutput && args.indexOf('--last-failed') === -1) {
                    return;
                }
                const index = args.findIndex(arg => arg.startsWith('--junitxml='));
                if (index >= 0) {
                    const fileName = args[index].substr('--junitxml='.length);
                    const contents = fs.readFileSync(path.join(PYTEST_RESULTS_PATH, outputFileName), 'utf8');
                    fs.writeFileSync(fileName, contents, 'utf8');
                    callback({ out: '', source: 'stdout' });
                }
            });
        });
    }
    test('Run Tests', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('one.output');
        yield injectTestRunOutput('one.xml');
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const results = yield testManager.runTest(constants_2.CommandSource.ui);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 9, 'Failures');
        assert.equal(results.summary.passed, 17, 'Passed');
        assert.equal(results.summary.skipped, 3, 'skipped');
    }));
    test('Run Failed Tests', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('two.output');
        yield injectTestRunOutput('two.xml');
        yield injectTestRunOutput('two.again.xml', true);
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        let results = yield testManager.runTest(constants_2.CommandSource.ui);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 9, 'Failures');
        assert.equal(results.summary.passed, 17, 'Passed');
        assert.equal(results.summary.skipped, 3, 'skipped');
        results = yield testManager.runTest(constants_2.CommandSource.ui, undefined, true);
        assert.equal(results.summary.errors, 0, 'Failed Errors');
        assert.equal(results.summary.failures, 9, 'Failed Failures');
        assert.equal(results.summary.passed, 0, 'Failed Passed');
        assert.equal(results.summary.skipped, 0, 'Failed skipped');
    }));
    test('Run Specific Test File', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('three.output');
        yield injectTestRunOutput('three.xml');
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        const testFile = {
            fullPath: path.join(UNITTEST_TEST_FILES_PATH, 'tests', 'test_another_pytest.py'),
            name: 'tests/test_another_pytest.py',
            nameToRun: 'tests/test_another_pytest.py',
            xmlName: 'tests/test_another_pytest.py',
            functions: [],
            suites: [],
            time: 0
        };
        const testFileToRun = { testFile: [testFile], testFolder: [], testFunction: [], testSuite: [] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testFileToRun);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    }));
    test('Run Specific Test Suite', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('four.output');
        yield injectTestRunOutput('four.xml');
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        const testSuite = { testFile: [], testFolder: [], testFunction: [], testSuite: [tests.testSuites[0].testSuite] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    }));
    test('Run Specific Test Function', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('five.output');
        yield injectTestRunOutput('five.xml');
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        const testFn = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    }));
});
//# sourceMappingURL=pytest.run.test.js.map