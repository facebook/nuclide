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
const chai_1 = require("chai");
const chaipromise = require("chai-as-promised");
const typeMoq = require("typemoq");
const types_1 = require("../../../client/common/application/types");
const platform_1 = require("../../../client/common/utils/platform");
const testUtils_1 = require("../../../client/unittests/common/testUtils");
const flatteningVisitor_1 = require("../../../client/unittests/common/testVisitors/flatteningVisitor");
const parserService_1 = require("../../../client/unittests/pytest/services/parserService");
const pytest_unittest_parser_data_1 = require("./pytest_unittest_parser_data");
chai_1.use(chaipromise);
// The PyTest test parsing is done via the stdout result of the
// `pytest --collect-only` command.
//
// There are a few limitations with this approach, the largest issue is mixing
// package and non-package style codebases (stdout does not give subdir
// information of tests in a package when __init__.py is not present).
//
// However, to test all of the various layouts that are available, we have
// created a JSON structure that defines all the tests - see file
// `pytest_unittest_parser_data.ts` in this folder.
suite('Unit Tests - PyTest - Test Parser used in discovery', () => {
    // Build tests for the test data that is relevant for this platform.
    const testPlatformType = platform_1.getOSType() === platform_1.OSType.Windows ?
        pytest_unittest_parser_data_1.PytestDataPlatformType.Windows : pytest_unittest_parser_data_1.PytestDataPlatformType.NonWindows;
    pytest_unittest_parser_data_1.pytestScenarioData.forEach((testScenario) => {
        if (testPlatformType === testScenario.platform) {
            const testDescription = `PyTest${testScenario.pytest_version_spec}: ${testScenario.description}`;
            test(testDescription, () => __awaiter(this, void 0, void 0, function* () {
                // Setup the service container for use by the parser.
                const serviceContainer = typeMoq.Mock.ofType();
                const appShell = typeMoq.Mock.ofType();
                const cmdMgr = typeMoq.Mock.ofType();
                serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_1.IApplicationShell), typeMoq.It.isAny()))
                    .returns(() => {
                    return appShell.object;
                });
                serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_1.ICommandManager), typeMoq.It.isAny()))
                    .returns(() => {
                    return cmdMgr.object;
                });
                // Create mocks used in the test discovery setup.
                const outChannel = typeMoq.Mock.ofType();
                const cancelToken = typeMoq.Mock.ofType();
                cancelToken.setup(c => c.isCancellationRequested).returns(() => false);
                const wsFolder = typeMoq.Mock.ofType();
                // Create the test options for the mocked-up test. All data is either
                // mocked or is taken from the JSON test data itself.
                const options = {
                    args: [],
                    cwd: testScenario.rootdir,
                    ignoreCache: true,
                    outChannel: outChannel.object,
                    token: cancelToken.object,
                    workspaceFolder: wsFolder.object
                };
                // Setup the parser.
                const testFlattener = new flatteningVisitor_1.TestFlatteningVisitor();
                const testHlp = new testUtils_1.TestsHelper(testFlattener, serviceContainer.object);
                const parser = new parserService_1.TestsParser(testHlp);
                // Each test scenario has a 'stdout' member that is an array of
                // stdout lines. Join them here such that the parser can operate
                // on stdout-like data.
                const stdout = testScenario.stdout.join('\n');
                const parsedTests = parser.parse(stdout, options);
                // Now we can actually perform tests.
                chai_1.expect(parsedTests).is.not.equal(undefined, 'Should have gotten tests extracted from the parsed pytest result content.');
                chai_1.expect(parsedTests.testFunctions.length).equals(testScenario.functionCount, `Parsed pytest summary contained ${testScenario.functionCount} test functions.`);
                testScenario.test_functions.forEach((funcName) => {
                    const findAllTests = parsedTests.testFunctions.filter((tstFunc) => {
                        return tstFunc.testFunction.nameToRun === funcName;
                    });
                    // Each test identified in the testScenario should exist once and only once.
                    chai_1.expect(findAllTests).is.not.equal(undefined, `Could not find "${funcName}" in tests.`);
                    chai_1.expect(findAllTests.length).is.equal(1, 'There should be exactly one instance of each test.');
                });
            }));
        }
    });
});
//# sourceMappingURL=pytest.testparser.unit.test.js.map