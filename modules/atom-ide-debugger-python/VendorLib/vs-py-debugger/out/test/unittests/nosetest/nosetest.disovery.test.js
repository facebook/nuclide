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
const helper_1 = require("../helper");
const serviceRegistry_1 = require("../serviceRegistry");
const initialize_1 = require("./../../initialize");
const PYTHON_FILES_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles');
const UNITTEST_TEST_FILES_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'noseFiles');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const filesToDelete = [
    path.join(UNITTEST_TEST_FILES_PATH, '.noseids'),
    path.join(UNITTEST_SINGLE_TEST_FILE_PATH, '.noseids')
];
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - nose - discovery with mocked process output', () => {
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
                    let out = fs.readFileSync(path.join(UNITTEST_TEST_FILES_PATH, outputFileName), 'utf8');
                    // Value in the test files.
                    out = out.replace(/\/Users\/donjayamanne\/.vscode\/extensions\/pythonVSCode\/src\/test\/pythonFiles/g, PYTHON_FILES_PATH);
                    callback({
                        out,
                        source: 'stdout'
                    });
                }
            });
        });
    }
    test('Discover Tests (single test file)', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('one.output');
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        helper_1.lookForTestFile(tests, path.join('tests', 'test_one.py'));
    }));
    test('Check that nameToRun in testSuites has class name after : (single test file)', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('two.output');
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testSuites.every(t => t.testSuite.name === t.testSuite.nameToRun.split(':')[1]), true, 'Suite name does not match class name');
    }));
    test('Discover Tests (-m=test)', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('three.output');
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 5, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 16, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 6, 'Incorrect number of test suites');
        helper_1.lookForTestFile(tests, path.join('tests', 'test_unittest_one.py'));
        helper_1.lookForTestFile(tests, path.join('tests', 'test_unittest_two.py'));
        helper_1.lookForTestFile(tests, path.join('tests', 'unittest_three_test.py'));
        helper_1.lookForTestFile(tests, path.join('tests', 'test4.py'));
        helper_1.lookForTestFile(tests, 'test_root.py');
    }));
    test('Discover Tests (-w=specific -m=tst)', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('four.output');
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-w', 'specific', '-m', 'tst'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        helper_1.lookForTestFile(tests, path.join('specific', 'tst_unittest_one.py'));
        helper_1.lookForTestFile(tests, path.join('specific', 'tst_unittest_two.py'));
    }));
    test('Discover Tests (-m=test_)', () => __awaiter(this, void 0, void 0, function* () {
        yield injectTestDiscoveryOutput('five.output');
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test_'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        helper_1.lookForTestFile(tests, 'test_root.py');
    }));
});
//# sourceMappingURL=nosetest.disovery.test.js.map