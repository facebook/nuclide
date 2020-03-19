"use strict";
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
const fs = require("fs-extra");
const path = require("path");
const vscode_1 = require("vscode");
const constants_1 = require("../../client/unittests/common/constants");
const types_1 = require("../../client/unittests/common/types");
const common_1 = require("../common");
const initialize_1 = require("./../initialize");
const serviceRegistry_1 = require("./serviceRegistry");
const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
const testFile = path.join(testFilesPath, 'tests', 'test_debugger_two.py');
const testFileWithFewTests = path.join(testFilesPath, 'tests', 'test_debugger_two.txt');
const testFileWithMoreTests = path.join(testFilesPath, 'tests', 'test_debugger_two.updated.txt');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests re-discovery', () => {
    let ioc;
    const configTarget = initialize_1.IS_MULTI_ROOT_TEST ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Workspace;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initialize();
    }));
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield fs.copy(testFileWithFewTests, testFile, { overwrite: true });
        yield common_1.deleteDirectory(path.join(testFilesPath, '.cache'));
        yield resetSettings();
        yield initialize_1.initializeTest();
        initializeDI();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield resetSettings();
        yield fs.copy(testFileWithFewTests, testFile, { overwrite: true });
        yield common_1.deleteFile(path.join(path.dirname(testFile), `${path.basename(testFile, '.py')}.pyc`));
    }));
    function resetSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield common_1.updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, common_1.rootWorkspaceUri, configTarget);
            yield common_1.updateSetting('unitTest.nosetestArgs', [], common_1.rootWorkspaceUri, configTarget);
            yield common_1.updateSetting('unitTest.pyTestArgs', [], common_1.rootWorkspaceUri, configTarget);
        });
    }
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();
    }
    function discoverUnitTests(testProvider) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = ioc.serviceContainer.get(types_1.ITestManagerFactory)(testProvider, common_1.rootWorkspaceUri, testFilesPath);
            let tests = yield testManager.discoverTests(constants_1.CommandSource.ui, true, true);
            chai_1.assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
            chai_1.assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
            chai_1.assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
            yield common_1.deleteFile(path.join(path.dirname(testFile), `${path.basename(testFile, '.py')}.pyc`));
            yield fs.copy(testFileWithMoreTests, testFile, { overwrite: true });
            tests = yield testManager.discoverTests(constants_1.CommandSource.ui, true, true);
            chai_1.assert.equal(tests.testFunctions.length, 4, 'Incorrect number of updated test functions');
        });
    }
    test('Re-discover tests (unittest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        yield discoverUnitTests('unittest');
    }));
    test('Re-discover tests (pytest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        yield discoverUnitTests('pytest');
    }));
    test('Re-discover tests (nosetest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        yield discoverUnitTests('nosetest');
    }));
});
//# sourceMappingURL=rediscover.test.js.map