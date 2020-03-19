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
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const constants_1 = require("../../../client/common/constants");
const constants_2 = require("../../../client/unittests/common/constants");
const types_1 = require("../../../client/unittests/common/types");
const common_1 = require("../../common");
const helper_1 = require("../helper");
const serviceRegistry_1 = require("../serviceRegistry");
const initialize_1 = require("./../../initialize");
const UNITTEST_TEST_FILES_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'noseFiles');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const filesToDelete = [
    path.join(UNITTEST_TEST_FILES_PATH, '.noseids'),
    path.join(UNITTEST_SINGLE_TEST_FILE_PATH, '.noseids')
];
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - nose - discovery against actual python process', () => {
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
        ioc.registerProcessTypes();
        ioc.registerUnitTestTypes();
        ioc.registerVariableTypes();
    }
    test('Discover Tests (single test file)', () => __awaiter(this, void 0, void 0, function* () {
        const factory = ioc.serviceContainer.get(types_1.ITestManagerFactory);
        const testManager = factory('nosetest', common_1.rootWorkspaceUri, UNITTEST_SINGLE_TEST_FILE_PATH);
        const tests = yield testManager.discoverTests(constants_2.CommandSource.ui, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
        helper_1.lookForTestFile(tests, path.join('tests', 'test_one.py'));
    }));
});
//# sourceMappingURL=nosetest.test.js.map