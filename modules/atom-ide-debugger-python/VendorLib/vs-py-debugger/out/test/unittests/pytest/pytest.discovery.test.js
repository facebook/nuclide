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
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const UNITTEST_TEST_FILES_PATH_WITH_CONFIGS = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'unitestsWithConfigs');
const unitTestTestFilesCwdPath = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'cwd', 'src');
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - pytest - discovery with mocked process output', () => {
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
    function injectTestDiscoveryOutput(output) {
        return __awaiter(this, void 0, void 0, function* () {
            const procService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory).create();
            procService.onExecObservable((file, args, options, callback) => {
                if (args.indexOf('--collect-only') >= 0) {
                    callback({
                        out: output,
                        source: 'stdout'
                    });
                }
            });
        });
    }
    test('Discover Tests (single test file)', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/single, inifile:
        plugins: pylama-7.4.3
        collected 6 items
        <Module 'test_root.py'>
          <UnitTestCase 'Test_Root_test1'>
            <TestCaseFunction 'test_Root_A'>
            <TestCaseFunction 'test_Root_B'>
            <TestCaseFunction 'test_Root_c'>
        <Module 'tests/test_one.py'>
          <UnitTestCase 'Test_test1'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>
            <TestCaseFunction 'test_c'>

        ========================= no tests ran in 0.03 seconds =========================
        `);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
    }));
    test('Discover Tests (pattern = test_)', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/standard, inifile:
        plugins: pylama-7.4.3
        collected 29 items
        <Module 'test_root.py'>
          <UnitTestCase 'Test_Root_test1'>
            <TestCaseFunction 'test_Root_A'>
            <TestCaseFunction 'test_Root_B'>
            <TestCaseFunction 'test_Root_c'>
        <Module 'tests/test_another_pytest.py'>
          <Function 'test_username'>
          <Function 'test_parametrized_username[one]'>
          <Function 'test_parametrized_username[two]'>
          <Function 'test_parametrized_username[three]'>
        <Module 'tests/test_pytest.py'>
          <Class 'Test_CheckMyApp'>
            <Instance '()'>
              <Function 'test_simple_check'>
              <Function 'test_complex_check'>
              <Class 'Test_NestedClassA'>
                <Instance '()'>
                  <Function 'test_nested_class_methodB'>
                  <Class 'Test_nested_classB_Of_A'>
                    <Instance '()'>
                      <Function 'test_d'>
                  <Function 'test_nested_class_methodC'>
              <Function 'test_simple_check2'>
              <Function 'test_complex_check2'>
          <Function 'test_username'>
          <Function 'test_parametrized_username[one]'>
          <Function 'test_parametrized_username[two]'>
          <Function 'test_parametrized_username[three]'>
        <Module 'tests/test_unittest_one.py'>
          <UnitTestCase 'Test_test1'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>
            <TestCaseFunction 'test_c'>
        <Module 'tests/test_unittest_two.py'>
          <UnitTestCase 'Test_test2'>
            <TestCaseFunction 'test_A2'>
            <TestCaseFunction 'test_B2'>
            <TestCaseFunction 'test_C2'>
            <TestCaseFunction 'test_D2'>
          <UnitTestCase 'Test_test2a'>
            <TestCaseFunction 'test_222A2'>
            <TestCaseFunction 'test_222B2'>
        <Module 'tests/unittest_three_test.py'>
          <UnitTestCase 'Test_test3'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>

        ========================= no tests ran in 0.05 seconds =========================
        "
        PROBLEMS
        OUTPUT
        DEBUG CONSOLE
        TERMINAL


        W

        Find

        `);
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 6, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 29, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 8, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_two.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/unittest_three_test.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/test_another_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
    }));
    test('Discover Tests (pattern = _test)', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/standard, inifile:
        plugins: pylama-7.4.3
        collected 29 items
        <Module 'tests/unittest_three_test.py'>
          <UnitTestCase 'Test_test3'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>

        ============================= 27 tests deselected ==============================
        ======================== 27 deselected in 0.05 seconds =========================
        `);
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=_test.py'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'tests/unittest_three_test.py' && t.nameToRun === t.name), true, 'Test File not found');
    }));
    test('Discover Tests (with config)', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/unitestsWithConfigs, inifile: pytest.ini
        plugins: pylama-7.4.3
        collected 14 items
        <Module 'other/test_pytest.py'>
          <Class 'Test_CheckMyApp'>
            <Instance '()'>
              <Function 'test_simple_check'>
              <Function 'test_complex_check'>
              <Class 'Test_NestedClassA'>
                <Instance '()'>
                  <Function 'test_nested_class_methodB'>
                  <Class 'Test_nested_classB_Of_A'>
                    <Instance '()'>
                      <Function 'test_d'>
                  <Function 'test_nested_class_methodC'>
              <Function 'test_simple_check2'>
              <Function 'test_complex_check2'>
          <Function 'test_username'>
          <Function 'test_parametrized_username[one]'>
          <Function 'test_parametrized_username[two]'>
          <Function 'test_parametrized_username[three]'>
        <Module 'other/test_unittest_one.py'>
          <UnitTestCase 'Test_test1'>
            <TestCaseFunction 'test_A'>
            <TestCaseFunction 'test_B'>
            <TestCaseFunction 'test_c'>

        ========================= no tests ran in 0.04 seconds =========================
        `);
        yield common_1.updateSetting('unitTest.pyTestArgs', [], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, UNITTEST_TEST_FILES_PATH_WITH_CONFIGS);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 14, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 4, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'other/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'other/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
    }));
    test('Setting cwd should return tests', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-multiline-string
        yield injectTestDiscoveryOutput(`
        ============================= test session starts ==============================
        platform darwin -- Python 3.6.2, pytest-3.3.0, py-1.5.2, pluggy-0.6.0
        rootdir: /Users/donjayamanne/.vscode/extensions/pythonVSCode/src/test/pythonFiles/testFiles/cwd/src, inifile:
        plugins: pylama-7.4.3
        collected 1 item
        <Module 'tests/test_cwd.py'>
          <UnitTestCase 'Test_Current_Working_Directory'>
            <TestCaseFunction 'test_cwd'>

        ========================= no tests ran in 0.02 seconds =========================
        `);
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        const factory = ioc.serviceContainer.get(types_2.ITestManagerFactory);
        const testManager = factory('pytest', common_1.rootWorkspaceUri, unitTestTestFilesCwdPath);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 1, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 1, 'Incorrect number of test suites');
    }));
});
//# sourceMappingURL=pytest.discovery.test.js.map