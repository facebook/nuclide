// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
// tslint:disable:max-func-body-length
const chai_1 = require("chai");
const chaipromise = require("chai-as-promised");
const path = require("path");
const typeMoq = require("typemoq");
const constants_1 = require("../../../client/unittests/common/constants");
const testUtils_1 = require("../../../client/unittests/common/testUtils");
const flatteningVisitor_1 = require("../../../client/unittests/common/testVisitors/flatteningVisitor");
const types_1 = require("../../../client/unittests/common/types");
const types_2 = require("../../../client/unittests/types");
const discoveryService_1 = require("../../../client/unittests/unittest/services/discoveryService");
const parserService_1 = require("../../../client/unittests/unittest/services/parserService");
chai_1.use(chaipromise);
suite('Unit Tests - Unittest - Discovery', () => {
    let discoveryService;
    let argsHelper;
    let testParser;
    let runner;
    let serviceContainer;
    const dir = path.join('a', 'b', 'c');
    const pattern = 'Pattern_To_Search_For';
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType();
        argsHelper = typeMoq.Mock.ofType();
        testParser = typeMoq.Mock.ofType();
        runner = typeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_2.IArgumentsHelper), typeMoq.It.isAny()))
            .returns(() => argsHelper.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_1.ITestRunner), typeMoq.It.isAny()))
            .returns(() => runner.object);
        discoveryService = new discoveryService_1.TestDiscoveryService(serviceContainer.object, testParser.object);
    });
    test('Ensure discovery is invoked with the right args with start directory defined with -s', () => __awaiter(this, void 0, void 0, function* () {
        const args = [];
        const runOutput = 'xyz';
        const tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => dir)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts) => {
            chai_1.expect(opts.args).to.include('-c');
            chai_1.expect(opts.args[1]).to.contain(dir);
            chai_1.expect(opts.args[1]).to.not.contain('loader.discover("."');
        })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());
        const options = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => false);
        const result = yield discoveryService.discoverTests(options.object);
        chai_1.expect(result).to.be.equal(tests);
        runner.verifyAll();
        testParser.verifyAll();
    }));
    test('Ensure discovery is invoked with the right args with start directory defined with --start-directory', () => __awaiter(this, void 0, void 0, function* () {
        const args = [];
        const runOutput = 'xyz';
        const tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--start-directory')))
            .returns(() => dir)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts) => {
            chai_1.expect(opts.args).to.include('-c');
            chai_1.expect(opts.args[1]).to.contain(dir);
            chai_1.expect(opts.args[1]).to.not.contain('loader.discover("."');
        })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());
        const options = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => false);
        const result = yield discoveryService.discoverTests(options.object);
        chai_1.expect(result).to.be.equal(tests);
        runner.verifyAll();
        testParser.verifyAll();
    }));
    test('Ensure discovery is invoked with the right args without a start directory', () => __awaiter(this, void 0, void 0, function* () {
        const args = [];
        const runOutput = 'xyz';
        const tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-s')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--start-directory')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts) => {
            chai_1.expect(opts.args).to.include('-c');
            chai_1.expect(opts.args[1]).to.not.contain(dir);
            chai_1.expect(opts.args[1]).to.contain('loader.discover("."');
        })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());
        const options = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => false);
        const result = yield discoveryService.discoverTests(options.object);
        chai_1.expect(result).to.be.equal(tests);
        runner.verifyAll();
        testParser.verifyAll();
    }));
    test('Ensure discovery is invoked with the right args without a pattern defined with -p', () => __awaiter(this, void 0, void 0, function* () {
        const args = [];
        const runOutput = 'xyz';
        const tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => pattern)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts) => {
            chai_1.expect(opts.args).to.include('-c');
            chai_1.expect(opts.args[1]).to.contain(pattern);
            chai_1.expect(opts.args[1]).to.not.contain('test*.py');
        })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());
        const options = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => false);
        const result = yield discoveryService.discoverTests(options.object);
        chai_1.expect(result).to.be.equal(tests);
        runner.verifyAll();
        testParser.verifyAll();
    }));
    test('Ensure discovery is invoked with the right args without a pattern defined with ---pattern', () => __awaiter(this, void 0, void 0, function* () {
        const args = [];
        const runOutput = 'xyz';
        const tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => pattern)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts) => {
            chai_1.expect(opts.args).to.include('-c');
            chai_1.expect(opts.args[1]).to.contain(pattern);
            chai_1.expect(opts.args[1]).to.not.contain('test*.py');
        })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());
        const options = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => false);
        const result = yield discoveryService.discoverTests(options.object);
        chai_1.expect(result).to.be.equal(tests);
        runner.verifyAll();
        testParser.verifyAll();
    }));
    test('Ensure discovery is invoked with the right args without a pattern not defined', () => __awaiter(this, void 0, void 0, function* () {
        const args = [];
        const runOutput = 'xyz';
        const tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts) => {
            chai_1.expect(opts.args).to.include('-c');
            chai_1.expect(opts.args[1]).to.not.contain(pattern);
            chai_1.expect(opts.args[1]).to.contain('test*.py');
        })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.once());
        const options = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => false);
        const result = yield discoveryService.discoverTests(options.object);
        chai_1.expect(result).to.be.equal(tests);
        runner.verifyAll();
        testParser.verifyAll();
    }));
    test('Ensure discovery is cancelled', () => __awaiter(this, void 0, void 0, function* () {
        const args = [];
        const runOutput = 'xyz';
        const tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('-p')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        argsHelper.setup(a => a.getOptionValues(typeMoq.It.isValue(args), typeMoq.It.isValue('--pattern')))
            .returns(() => undefined)
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.UNITTEST_PROVIDER), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isValue(runOutput), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.never());
        const options = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);
        const promise = discoveryService.discoverTests(options.object);
        yield chai_1.expect(promise).to.eventually.be.rejectedWith('cancelled');
        runner.verifyAll();
        testParser.verifyAll();
    }));
    test('Ensure discovery resolves test suites in n-depth directories', () => __awaiter(this, void 0, void 0, function* () {
        const testHelper = new testUtils_1.TestsHelper(new flatteningVisitor_1.TestFlatteningVisitor(), serviceContainer.object);
        const testsParser = new parserService_1.TestsParser(testHelper);
        const opts = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        const wspace = typeMoq.Mock.ofType();
        opts.setup(o => o.token).returns(() => token.object);
        opts.setup(o => o.workspaceFolder).returns(() => wspace.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);
        opts.setup(o => o.cwd).returns(() => '/home/user/dev');
        opts.setup(o => o.startDirectory).returns(() => '/home/user/dev/tests');
        const discoveryOutput = ['start',
            'apptests.debug.class_name.RootClassName.test_root',
            'apptests.debug.class_name.RootClassName.test_root_other',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first_other',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second_other',
            ''].join('\n');
        const tests = testsParser.parse(discoveryOutput, opts.object);
        chai_1.expect(tests.testFiles.length).to.be.equal(3);
        chai_1.expect(tests.testFunctions.length).to.be.equal(6);
        chai_1.expect(tests.testSuites.length).to.be.equal(3);
        chai_1.expect(tests.testFolders.length).to.be.equal(1);
        // now ensure that each test function belongs within a single test suite...
        tests.testFunctions.forEach(fn => {
            if (fn.parentTestSuite) {
                const testPrefix = fn.testFunction.nameToRun.startsWith(fn.parentTestSuite.nameToRun);
                chai_1.expect(testPrefix).to.equal(true, [`function ${fn.testFunction.name} has a parent suite ${fn.parentTestSuite.name}, `,
                    `but the parent suite 'nameToRun' (${fn.parentTestSuite.nameToRun}) isn't the `,
                    `prefix to the functions 'nameToRun' (${fn.testFunction.nameToRun})`].join(''));
            }
        });
    }));
    test('Ensure discovery resolves test files in n-depth directories', () => __awaiter(this, void 0, void 0, function* () {
        const testHelper = new testUtils_1.TestsHelper(new flatteningVisitor_1.TestFlatteningVisitor(), serviceContainer.object);
        const testsParser = new parserService_1.TestsParser(testHelper);
        const opts = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        const wspace = typeMoq.Mock.ofType();
        opts.setup(o => o.token).returns(() => token.object);
        opts.setup(o => o.workspaceFolder).returns(() => wspace.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);
        opts.setup(o => o.cwd).returns(() => '/home/user/dev');
        opts.setup(o => o.startDirectory).returns(() => '/home/user/dev/tests');
        const discoveryOutput = ['start',
            'apptests.debug.class_name.RootClassName.test_root',
            'apptests.debug.class_name.RootClassName.test_root_other',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first_other',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second_other',
            ''].join('\n');
        const tests = testsParser.parse(discoveryOutput, opts.object);
        chai_1.expect(tests.testFiles.length).to.be.equal(3);
        chai_1.expect(tests.testFunctions.length).to.be.equal(6);
        chai_1.expect(tests.testSuites.length).to.be.equal(3);
        chai_1.expect(tests.testFolders.length).to.be.equal(1);
        // now ensure that the 'nameToRun' for each test function begins with its file's a single test suite...
        tests.testFunctions.forEach(fn => {
            if (fn.parentTestSuite) {
                const testPrefix = fn.testFunction.nameToRun.startsWith(fn.parentTestFile.nameToRun);
                chai_1.expect(testPrefix).to.equal(true, [`function ${fn.testFunction.name} was found in file ${fn.parentTestFile.name}, `,
                    `but the parent file 'nameToRun' (${fn.parentTestFile.nameToRun}) isn't the `,
                    `prefix to the functions 'nameToRun' (${fn.testFunction.nameToRun})`].join(''));
            }
        });
    }));
    test('Ensure discovery resolves test suites in n-depth directories when no start directory is given', () => __awaiter(this, void 0, void 0, function* () {
        const testHelper = new testUtils_1.TestsHelper(new flatteningVisitor_1.TestFlatteningVisitor(), serviceContainer.object);
        const testsParser = new parserService_1.TestsParser(testHelper);
        const opts = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        const wspace = typeMoq.Mock.ofType();
        opts.setup(o => o.token).returns(() => token.object);
        opts.setup(o => o.workspaceFolder).returns(() => wspace.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);
        opts.setup(o => o.cwd).returns(() => '/home/user/dev');
        opts.setup(o => o.startDirectory).returns(() => '');
        const discoveryOutput = ['start',
            'apptests.debug.class_name.RootClassName.test_root',
            'apptests.debug.class_name.RootClassName.test_root_other',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first_other',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second_other',
            ''].join('\n');
        const tests = testsParser.parse(discoveryOutput, opts.object);
        chai_1.expect(tests.testFiles.length).to.be.equal(3);
        chai_1.expect(tests.testFunctions.length).to.be.equal(6);
        chai_1.expect(tests.testSuites.length).to.be.equal(3);
        chai_1.expect(tests.testFolders.length).to.be.equal(1);
        // now ensure that each test function belongs within a single test suite...
        tests.testFunctions.forEach(fn => {
            if (fn.parentTestSuite) {
                const testPrefix = fn.testFunction.nameToRun.startsWith(fn.parentTestSuite.nameToRun);
                chai_1.expect(testPrefix).to.equal(true, [`function ${fn.testFunction.name} has a parent suite ${fn.parentTestSuite.name}, `,
                    `but the parent suite 'nameToRun' (${fn.parentTestSuite.nameToRun}) isn't the `,
                    `prefix to the functions 'nameToRun' (${fn.testFunction.nameToRun})`].join(''));
            }
        });
    }));
    test('Ensure discovery resolves test suites in n-depth directories when a relative start directory is given', () => __awaiter(this, void 0, void 0, function* () {
        const testHelper = new testUtils_1.TestsHelper(new flatteningVisitor_1.TestFlatteningVisitor(), serviceContainer.object);
        const testsParser = new parserService_1.TestsParser(testHelper);
        const opts = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        const wspace = typeMoq.Mock.ofType();
        opts.setup(o => o.token).returns(() => token.object);
        opts.setup(o => o.workspaceFolder).returns(() => wspace.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);
        opts.setup(o => o.cwd).returns(() => '/home/user/dev');
        opts.setup(o => o.startDirectory).returns(() => './tests');
        const discoveryOutput = ['start',
            'apptests.debug.class_name.RootClassName.test_root',
            'apptests.debug.class_name.RootClassName.test_root_other',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first',
            'apptests.debug.first.class_name.FirstLevelClassName.test_first_other',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second',
            'apptests.debug.first.second.class_name.SecondLevelClassName.test_second_other',
            ''].join('\n');
        const tests = testsParser.parse(discoveryOutput, opts.object);
        chai_1.expect(tests.testFiles.length).to.be.equal(3);
        chai_1.expect(tests.testFunctions.length).to.be.equal(6);
        chai_1.expect(tests.testSuites.length).to.be.equal(3);
        chai_1.expect(tests.testFolders.length).to.be.equal(1);
        // now ensure that each test function belongs within a single test suite...
        tests.testFunctions.forEach(fn => {
            if (fn.parentTestSuite) {
                const testPrefix = fn.testFunction.nameToRun.startsWith(fn.parentTestSuite.nameToRun);
                chai_1.expect(testPrefix).to.equal(true, [`function ${fn.testFunction.name} has a parent suite ${fn.parentTestSuite.name}, `,
                    `but the parent suite 'nameToRun' (${fn.parentTestSuite.nameToRun}) isn't the `,
                    `prefix to the functions 'nameToRun' (${fn.testFunction.nameToRun})`].join(''));
            }
        });
    }));
    test('Ensure discovery will not fail with blank content', () => __awaiter(this, void 0, void 0, function* () {
        const testHelper = new testUtils_1.TestsHelper(new flatteningVisitor_1.TestFlatteningVisitor(), serviceContainer.object);
        const testsParser = new parserService_1.TestsParser(testHelper);
        const opts = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        const wspace = typeMoq.Mock.ofType();
        opts.setup(o => o.token).returns(() => token.object);
        opts.setup(o => o.workspaceFolder).returns(() => wspace.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);
        opts.setup(o => o.cwd).returns(() => '/home/user/dev');
        opts.setup(o => o.startDirectory).returns(() => './tests');
        const tests = testsParser.parse('', opts.object);
        chai_1.expect(tests.testFiles.length).to.be.equal(0);
        chai_1.expect(tests.testFunctions.length).to.be.equal(0);
        chai_1.expect(tests.testSuites.length).to.be.equal(0);
        chai_1.expect(tests.testFolders.length).to.be.equal(0);
    }));
    test('Ensure discovery will not fail with corrupt content', () => __awaiter(this, void 0, void 0, function* () {
        const testHelper = new testUtils_1.TestsHelper(new flatteningVisitor_1.TestFlatteningVisitor(), serviceContainer.object);
        const testsParser = new parserService_1.TestsParser(testHelper);
        const opts = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        const wspace = typeMoq.Mock.ofType();
        opts.setup(o => o.token).returns(() => token.object);
        opts.setup(o => o.workspaceFolder).returns(() => wspace.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);
        opts.setup(o => o.cwd).returns(() => '/home/user/dev');
        opts.setup(o => o.startDirectory).returns(() => './tests');
        const discoveryOutput = ['a;lskdjfa',
            'allikbrilkpdbfkdfbalk;nfm',
            '',
            ';;h,spmn,nlikmslkjls.bmnl;klkjna;jdfngad,lmvnjkldfhb',
            ''].join('\n');
        const tests = testsParser.parse(discoveryOutput, opts.object);
        chai_1.expect(tests.testFiles.length).to.be.equal(0);
        chai_1.expect(tests.testFunctions.length).to.be.equal(0);
        chai_1.expect(tests.testSuites.length).to.be.equal(0);
        chai_1.expect(tests.testFolders.length).to.be.equal(0);
    }));
    test('Ensure discovery resolves when no tests are found in the given path', () => __awaiter(this, void 0, void 0, function* () {
        const testHelper = new testUtils_1.TestsHelper(new flatteningVisitor_1.TestFlatteningVisitor(), serviceContainer.object);
        const testsParser = new parserService_1.TestsParser(testHelper);
        const opts = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        const wspace = typeMoq.Mock.ofType();
        opts.setup(o => o.token).returns(() => token.object);
        opts.setup(o => o.workspaceFolder).returns(() => wspace.object);
        token.setup(t => t.isCancellationRequested)
            .returns(() => true);
        opts.setup(o => o.cwd).returns(() => '/home/user/dev');
        opts.setup(o => o.startDirectory).returns(() => './tests');
        const discoveryOutput = 'start';
        const tests = testsParser.parse(discoveryOutput, opts.object);
        chai_1.expect(tests.testFiles.length).to.be.equal(0);
        chai_1.expect(tests.testFunctions.length).to.be.equal(0);
        chai_1.expect(tests.testSuites.length).to.be.equal(0);
        chai_1.expect(tests.testFolders.length).to.be.equal(0);
    }));
});
//# sourceMappingURL=unittest.discovery.unit.test.js.map