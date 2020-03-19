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
const chaiAsPromised = require("chai-as-promised");
const path = require("path");
const vscode_1 = require("vscode");
const async_1 = require("../../client/common/utils/async");
const runner_1 = require("../../client/unittests//nosetest/runner");
const runner_2 = require("../../client/unittests//pytest/runner");
const runner_3 = require("../../client/unittests//unittest/runner");
const argumentsHelper_1 = require("../../client/unittests/common/argumentsHelper");
const constants_1 = require("../../client/unittests/common/constants");
const runner_4 = require("../../client/unittests/common/runner");
const types_1 = require("../../client/unittests/common/types");
const xUnitParser_1 = require("../../client/unittests/common/xUnitParser");
const argsService_1 = require("../../client/unittests/nosetest/services/argsService");
const argsService_2 = require("../../client/unittests/pytest/services/argsService");
const types_2 = require("../../client/unittests/types");
const helper_1 = require("../../client/unittests/unittest/helper");
const argsService_3 = require("../../client/unittests/unittest/services/argsService");
const common_1 = require("../common");
const initialize_1 = require("./../initialize");
const mocks_1 = require("./mocks");
const serviceRegistry_1 = require("./serviceRegistry");
chai_1.use(chaiAsPromised);
const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - debugging', () => {
    let ioc;
    const configTarget = initialize_1.IS_MULTI_ROOT_TEST ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Workspace;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        // Test disvovery is where the delay is, hence give 10 seconds (as we discover tests at least twice in each test).
        yield initialize_1.initialize();
        yield common_1.updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, common_1.rootWorkspaceUri, configTarget);
        yield common_1.updateSetting('unitTest.nosetestArgs', [], common_1.rootWorkspaceUri, configTarget);
        yield common_1.updateSetting('unitTest.pyTestArgs', [], common_1.rootWorkspaceUri, configTarget);
    }));
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield common_1.deleteDirectory(path.join(testFilesPath, '.cache'));
        yield initialize_1.initializeTest();
        initializeDI();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield common_1.updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, common_1.rootWorkspaceUri, configTarget);
        yield common_1.updateSetting('unitTest.nosetestArgs', [], common_1.rootWorkspaceUri, configTarget);
        yield common_1.updateSetting('unitTest.pyTestArgs', [], common_1.rootWorkspaceUri, configTarget);
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerTestParsers();
        ioc.registerTestVisitors();
        ioc.registerTestDiscoveryServices();
        ioc.registerTestResultsHelper();
        ioc.registerTestStorage();
        ioc.registerTestsHelper();
        ioc.registerTestManagers();
        ioc.registerMockUnitTestSocketServer();
        ioc.serviceManager.add(types_2.IArgumentsHelper, argumentsHelper_1.ArgumentsHelper);
        ioc.serviceManager.add(types_1.ITestRunner, runner_4.TestRunner);
        ioc.serviceManager.add(types_1.IXUnitParser, xUnitParser_1.XUnitParser);
        ioc.serviceManager.add(types_2.IUnitTestHelper, helper_1.UnitTestHelper);
        ioc.serviceManager.add(types_2.IArgumentsService, argsService_1.ArgumentsService, constants_1.NOSETEST_PROVIDER);
        ioc.serviceManager.add(types_2.IArgumentsService, argsService_2.ArgumentsService, constants_1.PYTEST_PROVIDER);
        ioc.serviceManager.add(types_2.IArgumentsService, argsService_3.ArgumentsService, constants_1.UNITTEST_PROVIDER);
        ioc.serviceManager.add(types_2.ITestManagerRunner, runner_2.TestManagerRunner, constants_1.PYTEST_PROVIDER);
        ioc.serviceManager.add(types_2.ITestManagerRunner, runner_1.TestManagerRunner, constants_1.NOSETEST_PROVIDER);
        ioc.serviceManager.add(types_2.ITestManagerRunner, runner_3.TestManagerRunner, constants_1.UNITTEST_PROVIDER);
        ioc.serviceManager.addSingleton(types_1.ITestDebugLauncher, mocks_1.MockDebugLauncher);
    }
    function testStartingDebugger(testProvider) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = ioc.serviceContainer.get(types_1.ITestManagerFactory)(testProvider, common_1.rootWorkspaceUri, testFilesPath);
            const mockDebugLauncher = ioc.serviceContainer.get(types_1.ITestDebugLauncher);
            const tests = yield testManager.discoverTests(constants_1.CommandSource.commandPalette, true, true);
            chai_1.assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
            chai_1.assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
            chai_1.assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
            const deferred = async_1.createDeferred();
            const testFunction = [tests.testFunctions[0].testFunction];
            const runningPromise = testManager.runTest(constants_1.CommandSource.commandPalette, { testFunction }, false, true);
            // This promise should never resolve nor reject.
            runningPromise
                .then(() => deferred.reject('Debugger stopped when it shouldn\'t have'))
                .catch(error => deferred.reject(error));
            mockDebugLauncher.launched
                .then((launched) => {
                if (launched) {
                    deferred.resolve('');
                }
                else {
                    deferred.reject('Debugger not launched');
                }
            }).catch(error => deferred.reject(error));
            yield deferred.promise;
        });
    }
    test('Debugger should start (unittest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        yield testStartingDebugger('unittest');
    }));
    test('Debugger should start (pytest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        yield testStartingDebugger('pytest');
    }));
    test('Debugger should start (nosetest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        yield testStartingDebugger('nosetest');
    }));
    function testStoppingDebugger(testProvider) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = ioc.serviceContainer.get(types_1.ITestManagerFactory)(testProvider, common_1.rootWorkspaceUri, testFilesPath);
            const mockDebugLauncher = ioc.serviceContainer.get(types_1.ITestDebugLauncher);
            const tests = yield testManager.discoverTests(constants_1.CommandSource.commandPalette, true, true);
            chai_1.assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
            chai_1.assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
            chai_1.assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
            const testFunction = [tests.testFunctions[0].testFunction];
            const runningPromise = testManager.runTest(constants_1.CommandSource.commandPalette, { testFunction }, false, true);
            const launched = yield mockDebugLauncher.launched;
            chai_1.assert.isTrue(launched, 'Debugger not launched');
            const discoveryPromise = testManager.discoverTests(constants_1.CommandSource.commandPalette, true, true, true);
            yield chai_1.expect(runningPromise).to.be.rejectedWith(constants_1.CANCELLATION_REASON, 'Incorrect reason for ending the debugger');
            ioc.dispose(); // will cancel test discovery
            yield chai_1.expect(discoveryPromise).to.be.rejectedWith(constants_1.CANCELLATION_REASON, 'Incorrect reason for ending the debugger');
        });
    }
    test('Debugger should stop when user invokes a test discovery (unittest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        yield testStoppingDebugger('unittest');
    }));
    test('Debugger should stop when user invokes a test discovery (pytest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        yield testStoppingDebugger('pytest');
    }));
    test('Debugger should stop when user invokes a test discovery (nosetest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        yield testStoppingDebugger('nosetest');
    }));
    function testDebuggerWhenRediscoveringTests(testProvider) {
        return __awaiter(this, void 0, void 0, function* () {
            const testManager = ioc.serviceContainer.get(types_1.ITestManagerFactory)(testProvider, common_1.rootWorkspaceUri, testFilesPath);
            const mockDebugLauncher = ioc.serviceContainer.get(types_1.ITestDebugLauncher);
            const tests = yield testManager.discoverTests(constants_1.CommandSource.commandPalette, true, true);
            chai_1.assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
            chai_1.assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
            chai_1.assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');
            const testFunction = [tests.testFunctions[0].testFunction];
            const runningPromise = testManager.runTest(constants_1.CommandSource.commandPalette, { testFunction }, false, true);
            const launched = yield mockDebugLauncher.launched;
            chai_1.assert.isTrue(launched, 'Debugger not launched');
            const discoveryPromise = testManager.discoverTests(constants_1.CommandSource.commandPalette, false, true);
            const deferred = async_1.createDeferred();
            discoveryPromise
                // tslint:disable-next-line:no-unsafe-any
                .then(() => deferred.resolve(''))
                // tslint:disable-next-line:no-unsafe-any
                .catch(ex => deferred.reject(ex));
            // This promise should never resolve nor reject.
            runningPromise
                .then(() => 'Debugger stopped when it shouldn\'t have')
                .catch(() => 'Debugger crashed when it shouldn\'t have')
                // tslint:disable-next-line: no-floating-promises
                .then(error => {
                deferred.reject(error);
            });
            // Should complete without any errors
            yield deferred.promise;
        });
    }
    test('Debugger should not stop when test discovery is invoked automatically by extension (unittest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], common_1.rootWorkspaceUri, configTarget);
        yield testDebuggerWhenRediscoveringTests('unittest');
    }));
    test('Debugger should not stop when test discovery is invoked automatically by extension (pytest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.pyTestArgs', ['-k=test_'], common_1.rootWorkspaceUri, configTarget);
        yield testDebuggerWhenRediscoveringTests('pytest');
    }));
    test('Debugger should not stop when test discovery is invoked automatically by extension (nosetest)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('unitTest.nosetestArgs', ['-m', 'test'], common_1.rootWorkspaceUri, configTarget);
        yield testDebuggerWhenRediscoveringTests('nosetest');
    }));
});
//# sourceMappingURL=debugger.test.js.map