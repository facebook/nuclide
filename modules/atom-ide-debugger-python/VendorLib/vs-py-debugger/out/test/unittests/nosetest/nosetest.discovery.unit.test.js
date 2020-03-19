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
// tslint:disable-next-line:max-func-body-length
const chai_1 = require("chai");
const chaipromise = require("chai-as-promised");
const typeMoq = require("typemoq");
const constants_1 = require("../../../client/unittests/common/constants");
const types_1 = require("../../../client/unittests/common/types");
const discoveryService_1 = require("../../../client/unittests/nosetest/services/discoveryService");
const types_2 = require("../../../client/unittests/types");
chai_1.use(chaipromise);
suite('Unit Tests - nose - Discovery', () => {
    let discoveryService;
    let argsService;
    let testParser;
    let runner;
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType();
        argsService = typeMoq.Mock.ofType();
        testParser = typeMoq.Mock.ofType();
        runner = typeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_2.IArgumentsService), typeMoq.It.isAny()))
            .returns(() => argsService.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_1.ITestRunner), typeMoq.It.isAny()))
            .returns(() => runner.object);
        discoveryService = new discoveryService_1.TestDiscoveryService(serviceContainer.object, testParser.object);
    });
    test('Ensure discovery is invoked with the right args', () => __awaiter(this, void 0, void 0, function* () {
        const args = [];
        const runOutput = 'xyz';
        const tests = {
            summary: { errors: 1, failures: 0, passed: 0, skipped: 0 },
            testFiles: [], testFunctions: [], testSuites: [],
            rootTestFolders: [], testFolders: []
        };
        argsService.setup(a => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(types_2.TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.NOSETEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts) => {
            chai_1.expect(opts.args).to.include('--collect-only');
            chai_1.expect(opts.args).to.include('-vvv');
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
        argsService.verifyAll();
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
        argsService.setup(a => a.filterArguments(typeMoq.It.isValue(args), typeMoq.It.isValue(types_2.TestFilter.discovery)))
            .returns(() => [])
            .verifiable(typeMoq.Times.once());
        runner.setup(r => r.run(typeMoq.It.isValue(constants_1.NOSETEST_PROVIDER), typeMoq.It.isAny()))
            .callback((_, opts) => {
            chai_1.expect(opts.args).to.include('--collect-only');
            chai_1.expect(opts.args).to.include('-vvv');
        })
            .returns(() => Promise.resolve(runOutput))
            .verifiable(typeMoq.Times.once());
        testParser.setup(t => t.parse(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => tests)
            .verifiable(typeMoq.Times.never());
        const options = typeMoq.Mock.ofType();
        const token = typeMoq.Mock.ofType();
        token.setup(t => t.isCancellationRequested)
            .returns(() => true)
            .verifiable(typeMoq.Times.once());
        options.setup(o => o.args).returns(() => args);
        options.setup(o => o.token).returns(() => token.object);
        const promise = discoveryService.discoverTests(options.object);
        yield chai_1.expect(promise).to.eventually.be.rejectedWith('cancelled');
        argsService.verifyAll();
        runner.verifyAll();
        testParser.verifyAll();
    }));
});
//# sourceMappingURL=nosetest.discovery.unit.test.js.map