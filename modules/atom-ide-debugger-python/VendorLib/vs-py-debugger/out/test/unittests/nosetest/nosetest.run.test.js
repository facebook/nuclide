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
const UNITTEST_TEST_FILES_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'noseFiles');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const filesToDelete = [
    path.join(UNITTEST_TEST_FILES_PATH, '.noseids'),
    path.join(UNITTEST_SINGLE_TEST_FILE_PATH, '.noseids')
];
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - nose - run against actual python process', () => {
    let ioc;
    const configTarget = initialize_1.IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        yield common_1.updateSetting('unitTest.nosetestArgs', [], common_1.rootWorkspaceUri, configTarget);
        yield initialize_1.initialize();
    }));
    suiteTeardown(() => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.nosetestArgs', [], common_1.rootWorkspaceUri, configTarget);
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    }));
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initializeTest();
        initializeDI();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield common_1.updateSetting('unitTest.nosetestArgs', [], common_1.rootWorkspaceUri, configTarget);
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
        ioc.registerMockProcessTypes();
    }
    function injectTestDiscoveryOutput(outputFileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const procService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory).create();
            procService.onExecObservable((file, args, options, callback) => {
                if (args.indexOf('--collect-only') >= 0) {
                    callback({
                        out: fs.readFileSync(path.join(UNITTEST_TEST_FILES_PATH, outputFileName), 'utf8').replace(/\/Users\/donjayamanne\/.vscode\/extensions\/pythonVSCode\/src\/test\/pythonFiles\/testFiles\/noseFiles/g, UNITTEST_TEST_FILES_PATH),
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
                if (failedOutput && args.indexOf('--failed') === -1) {
                    return;
                }
                const index = args.findIndex(arg => arg.startsWith('--xunit-file='));
                if (index >= 0) {
                    const fileName = args[index].substr('--xunit-file='.length);
                    const contents = fs.readFileSync(path.join(UNITTEST_TEST_FILES_PATH, outputFileName), 'utf8');
                    fs.writeFileSync(fileName, contents, 'utf8');
                    callback({ out: '', source: 'stdout' });
                }
            });
        });
    }
    test('Run Tests', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('run.one.output');
        yield injectTestRunOutput('run.one.result');
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const results = yield testManager.runTest(constants_2.CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 7, 'Failures');
        assert.equal(results.summary.passed, 6, 'Passed');
        assert.equal(results.summary.skipped, 2, 'skipped');
    }));
    test('Run Failed Tests', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('run.two.output');
        yield injectTestRunOutput('run.two.result');
        yield injectTestRunOutput('run.two.again.result', true);
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        let results = yield testManager.runTest(constants_2.CommandSource.ui);
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 7, 'Failures');
        assert.equal(results.summary.passed, 6, 'Passed');
        assert.equal(results.summary.skipped, 2, 'skipped');
        results = yield testManager.runTest(constants_2.CommandSource.ui, undefined, true);
        assert.equal(results.summary.errors, 1, 'Errors again');
        assert.equal(results.summary.failures, 7, 'Failures again');
        assert.equal(results.summary.passed, 0, 'Passed again');
        assert.equal(results.summary.skipped, 0, 'skipped again');
    }));
    test('Run Specific Test File', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('run.three.output');
        yield injectTestRunOutput('run.three.result');
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        const testFileToRun = tests.testFiles.find(t => t.fullPath.endsWith('test_root.py'));
        assert.ok(testFileToRun, 'Test file not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testFile = { testFile: [testFileToRun], testFolder: [], testFunction: [], testSuite: [] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testFile);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    }));
    test('Run Specific Test Suite', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('run.four.output');
        yield injectTestRunOutput('run.four.result');
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        const testSuiteToRun = tests.testSuites.find(s => s.xmlClassName === 'test_root.Test_Root_test1');
        assert.ok(testSuiteToRun, 'Test suite not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testSuite = { testFile: [], testFolder: [], testFunction: [], testSuite: [testSuiteToRun.testSuite] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    }));
    test('Run Specific Test Function', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('run.five.output');
        yield injectTestRunOutput('run.five.result');
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        const testFnToRun = tests.testFunctions.find(f => f.xmlClassName === 'test_root.Test_Root_test1');
        assert.ok(testFnToRun, 'Test function not found');
        // tslint:disable-next-line:no-non-null-assertion
        const testFn = { testFile: [], testFolder: [], testFunction: [testFnToRun.testFunction], testSuite: [] };
        const results = yield testManager.runTest(constants_2.CommandSource.ui, testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    }));
});
//# sourceMappingURL=nosetest.run.test.js.map