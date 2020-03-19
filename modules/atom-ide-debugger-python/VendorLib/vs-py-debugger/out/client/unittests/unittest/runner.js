'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const path = require("path");
const constants_1 = require("../../common/constants");
const types_1 = require("../../common/types");
const async_1 = require("../../common/utils/async");
const misc_1 = require("../../common/utils/misc");
const types_2 = require("../../ioc/types");
const constants_2 = require("../common/constants");
const types_3 = require("../common/types");
const types_4 = require("../types");
const outcomeMapping = new Map();
outcomeMapping.set('passed', { status: types_3.TestStatus.Pass, summaryProperty: 'passed' });
outcomeMapping.set('failed', { status: types_3.TestStatus.Fail, summaryProperty: 'failures' });
outcomeMapping.set('error', { status: types_3.TestStatus.Error, summaryProperty: 'errors' });
outcomeMapping.set('skipped', { status: types_3.TestStatus.Skipped, summaryProperty: 'skipped' });
let TestManagerRunner = class TestManagerRunner {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.argsHelper = serviceContainer.get(types_4.IArgumentsHelper);
        this.testRunner = serviceContainer.get(types_3.ITestRunner);
        this.server = this.serviceContainer.get(types_3.IUnitTestSocketServer);
        this.logger = this.serviceContainer.get(types_1.ILogger);
        this.helper = this.serviceContainer.get(types_4.IUnitTestHelper);
    }
    // tslint:disable-next-line:max-func-body-length
    runTest(testResultsService, options, testManager) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.busy && !this.busy.completed) {
                return this.busy.promise;
            }
            this.busy = async_1.createDeferred();
            options.tests.summary.errors = 0;
            options.tests.summary.failures = 0;
            options.tests.summary.passed = 0;
            options.tests.summary.skipped = 0;
            let failFast = false;
            const testLauncherFile = path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
            this.server.on('error', (message, ...data) => this.logger.logError(`${message} ${data.join(' ')}`));
            this.server.on('log', misc_1.noop);
            this.server.on('connect', misc_1.noop);
            this.server.on('start', misc_1.noop);
            this.server.on('result', (data) => {
                const test = options.tests.testFunctions.find(t => t.testFunction.nameToRun === data.test);
                const statusDetails = outcomeMapping.get(data.outcome);
                if (test) {
                    test.testFunction.status = statusDetails.status;
                    test.testFunction.message = data.message;
                    test.testFunction.traceback = data.traceback;
                    options.tests.summary[statusDetails.summaryProperty] += 1;
                    if (failFast && (statusDetails.summaryProperty === 'failures' || statusDetails.summaryProperty === 'errors')) {
                        testManager.stop();
                    }
                }
                else {
                    if (statusDetails) {
                        options.tests.summary[statusDetails.summaryProperty] += 1;
                    }
                }
            });
            const port = yield this.server.start();
            const testPaths = this.helper.getIdsOfTestsToRun(options.tests, options.testsToRun);
            for (let counter = 0; counter < testPaths.length; counter += 1) {
                testPaths[counter] = `-t${testPaths[counter].trim()}`;
            }
            const runTestInternal = (testFile = '', testId = '') => __awaiter(this, void 0, void 0, function* () {
                let testArgs = this.buildTestArgs(options.args);
                failFast = testArgs.indexOf('--uf') >= 0;
                testArgs = testArgs.filter(arg => arg !== '--uf');
                testArgs.push(`--result-port=${port}`);
                if (testId.length > 0) {
                    testArgs.push(`-t${testId}`);
                }
                if (testFile.length > 0) {
                    testArgs.push(`--testFile=${testFile}`);
                }
                if (options.debug === true) {
                    const debugLauncher = this.serviceContainer.get(types_3.ITestDebugLauncher);
                    testArgs.push('--debug');
                    const launchOptions = { cwd: options.cwd, args: testArgs, token: options.token, outChannel: options.outChannel, testProvider: constants_2.UNITTEST_PROVIDER };
                    return debugLauncher.launchDebugger(launchOptions);
                }
                else {
                    const runOptions = {
                        args: [testLauncherFile].concat(testArgs),
                        cwd: options.cwd,
                        outChannel: options.outChannel,
                        token: options.token,
                        workspaceFolder: options.workspaceFolder
                    };
                    yield this.testRunner.run(constants_2.UNITTEST_PROVIDER, runOptions);
                }
            });
            // Test everything.
            if (testPaths.length === 0) {
                yield this.removeListenersAfter(runTestInternal());
            }
            else {
                let promise = Promise.resolve(undefined);
                // Ok, the test runner can only work with one test at a time.
                if (options.testsToRun) {
                    if (Array.isArray(options.testsToRun.testFile)) {
                        options.testsToRun.testFile.forEach(testFile => {
                            promise = promise.then(() => runTestInternal(testFile.fullPath, testFile.nameToRun));
                        });
                    }
                    if (Array.isArray(options.testsToRun.testSuite)) {
                        options.testsToRun.testSuite.forEach(testSuite => {
                            const testFileName = options.tests.testSuites.find(t => t.testSuite === testSuite).parentTestFile.fullPath;
                            promise = promise.then(() => runTestInternal(testFileName, testSuite.nameToRun));
                        });
                    }
                    if (Array.isArray(options.testsToRun.testFunction)) {
                        options.testsToRun.testFunction.forEach(testFn => {
                            const testFileName = options.tests.testFunctions.find(t => t.testFunction === testFn).parentTestFile.fullPath;
                            promise = promise.then(() => runTestInternal(testFileName, testFn.nameToRun));
                        });
                    }
                    yield this.removeListenersAfter(promise);
                }
            }
            testResultsService.updateResults(options.tests);
            this.busy.resolve(options.tests);
            return options.tests;
        });
    }
    // remove all the listeners from the server after all tests are complete,
    // and just pass the promise `after` through as we do not want to get in
    // the way here.
    // tslint:disable-next-line:no-any
    removeListenersAfter(after) {
        return __awaiter(this, void 0, void 0, function* () {
            return after
                .then(() => this.server.removeAllListeners())
                .catch((err) => {
                this.server.removeAllListeners();
                throw err; // keep propagating this downward
            });
        });
    }
    buildTestArgs(args) {
        const startTestDiscoveryDirectory = this.helper.getStartDirectory(args);
        let pattern = 'test*.py';
        const shortValue = this.argsHelper.getOptionValues(args, '-p');
        const longValueValue = this.argsHelper.getOptionValues(args, '-pattern');
        if (typeof shortValue === 'string') {
            pattern = shortValue;
        }
        else if (typeof longValueValue === 'string') {
            pattern = longValueValue;
        }
        const failFast = args.some(arg => arg.trim() === '-f' || arg.trim() === '--failfast');
        const verbosity = args.some(arg => arg.trim().indexOf('-v') === 0) ? 2 : 1;
        const testArgs = [`--us=${startTestDiscoveryDirectory}`, `--up=${pattern}`, `--uvInt=${verbosity}`];
        if (failFast) {
            testArgs.push('--uf');
        }
        return testArgs;
    }
};
TestManagerRunner = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], TestManagerRunner);
exports.TestManagerRunner = TestManagerRunner;
//# sourceMappingURL=runner.js.map