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
// tslint:disable:no-string-literal no-unused-expression chai-vague-errors max-func-body-length no-any
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const path = require("path");
const shortid = require("shortid");
const types_1 = require("../../client/common/types");
const types_2 = require("../../client/common/variables/types");
const helper_1 = require("../../client/debugger/debugAdapter/DebugClients/helper");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
chai_1.use(chaiAsPromised);
suite('Resolving Environment Variables when Debugging', () => {
    let ioc;
    let helper;
    let pathVariableName;
    let mockProcess;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        initializeDI();
        yield initialize_1.initializeTest();
        const envParser = ioc.serviceContainer.get(types_2.IEnvironmentVariablesService);
        const pathUtils = ioc.serviceContainer.get(types_1.IPathUtils);
        mockProcess = ioc.serviceContainer.get(types_1.ICurrentProcess);
        helper = new helper_1.DebugClientHelper(envParser, pathUtils, mockProcess);
        pathVariableName = pathUtils.getPathVariableName();
    }));
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield initialize_1.closeActiveWindows();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerMockProcess();
    }
    function testBasicProperties(console, expectedNumberOfVariables) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = {
                program: '', pythonPath: '', args: [], envFile: '',
                console
                // tslint:disable-next-line:no-any
            };
            const envVars = yield helper.getEnvironmentVariables(args);
            chai_1.expect(envVars).not.be.undefined;
            chai_1.expect(Object.keys(envVars)).lengthOf(expectedNumberOfVariables, 'Incorrect number of variables');
            chai_1.expect(envVars).to.have.property('PYTHONUNBUFFERED', '1', 'Property not found');
            chai_1.expect(envVars).to.have.property('PYTHONIOENCODING', 'UTF-8', 'Property not found');
        });
    }
    test('Confirm basic environment variables exist when launched in external terminal', () => testBasicProperties('externalTerminal', 2));
    test('Confirm basic environment variables exist when launched in intergrated terminal', () => testBasicProperties('integratedTerminal', 2));
    test('Confirm basic environment variables exist when launched in debug console', () => __awaiter(this, void 0, void 0, function* () {
        let expectedNumberOfVariables = Object.keys(mockProcess.env).length;
        if (mockProcess.env['PYTHONUNBUFFERED'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        if (mockProcess.env['PYTHONIOENCODING'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        yield testBasicProperties('none', expectedNumberOfVariables);
    }));
    function testJsonEnvVariables(console, expectedNumberOfVariables) {
        return __awaiter(this, void 0, void 0, function* () {
            const prop1 = shortid.generate();
            const prop2 = shortid.generate();
            const prop3 = shortid.generate();
            const env = {};
            env[prop1] = prop1;
            env[prop2] = prop2;
            mockProcess.env[prop3] = prop3;
            const args = {
                program: '', pythonPath: '', args: [], envFile: '',
                console, env
                // tslint:disable-next-line:no-any
            };
            const envVars = yield helper.getEnvironmentVariables(args);
            // tslint:disable-next-line:no-unused-expression chai-vague-errors
            chai_1.expect(envVars).not.be.undefined;
            chai_1.expect(Object.keys(envVars)).lengthOf(expectedNumberOfVariables, 'Incorrect number of variables');
            chai_1.expect(envVars).to.have.property('PYTHONUNBUFFERED', '1', 'Property not found');
            chai_1.expect(envVars).to.have.property('PYTHONIOENCODING', 'UTF-8', 'Property not found');
            chai_1.expect(envVars).to.have.property(prop1, prop1, 'Property not found');
            chai_1.expect(envVars).to.have.property(prop2, prop2, 'Property not found');
            if (console === 'none') {
                chai_1.expect(envVars).to.have.property(prop3, prop3, 'Property not found');
            }
            else {
                chai_1.expect(envVars).not.to.have.property(prop3, prop3, 'Property not found');
            }
        });
    }
    test('Confirm json environment variables exist when launched in external terminal', () => testJsonEnvVariables('externalTerminal', 2 + 2));
    test('Confirm json environment variables exist when launched in intergrated terminal', () => testJsonEnvVariables('integratedTerminal', 2 + 2));
    test('Confirm json environment variables exist when launched in debug console', () => __awaiter(this, void 0, void 0, function* () {
        // Add 3 for the 3 new json env variables
        let expectedNumberOfVariables = Object.keys(mockProcess.env).length + 3;
        if (mockProcess.env['PYTHONUNBUFFERED'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        if (mockProcess.env['PYTHONIOENCODING'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        yield testJsonEnvVariables('none', expectedNumberOfVariables);
    }));
    function testAppendingOfPaths(console, expectedNumberOfVariables, removePythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (removePythonPath && mockProcess.env.PYTHONPATH !== undefined) {
                delete mockProcess.env.PYTHONPATH;
            }
            const customPathToAppend = shortid.generate();
            const customPythonPathToAppend = shortid.generate();
            const prop1 = shortid.generate();
            const prop2 = shortid.generate();
            const prop3 = shortid.generate();
            const env = {};
            env[pathVariableName] = customPathToAppend;
            env['PYTHONPATH'] = customPythonPathToAppend;
            env[prop1] = prop1;
            env[prop2] = prop2;
            mockProcess.env[prop3] = prop3;
            const args = {
                program: '', pythonPath: '', args: [], envFile: '',
                console, env
            };
            const envVars = yield helper.getEnvironmentVariables(args);
            chai_1.expect(envVars).not.be.undefined;
            chai_1.expect(Object.keys(envVars)).lengthOf(expectedNumberOfVariables, 'Incorrect number of variables');
            chai_1.expect(envVars).to.have.property('PYTHONPATH');
            chai_1.expect(envVars).to.have.property(pathVariableName);
            chai_1.expect(envVars).to.have.property('PYTHONUNBUFFERED', '1', 'Property not found');
            chai_1.expect(envVars).to.have.property('PYTHONIOENCODING', 'UTF-8', 'Property not found');
            chai_1.expect(envVars).to.have.property(prop1, prop1, 'Property not found');
            chai_1.expect(envVars).to.have.property(prop2, prop2, 'Property not found');
            if (console === 'none') {
                chai_1.expect(envVars).to.have.property(prop3, prop3, 'Property not found');
            }
            else {
                chai_1.expect(envVars).not.to.have.property(prop3, prop3, 'Property not found');
            }
            // Confirm the paths have been appended correctly.
            const expectedPath = customPathToAppend + path.delimiter + mockProcess.env[pathVariableName];
            chai_1.expect(envVars).to.have.property(pathVariableName, expectedPath, 'PATH is not correct');
            // Confirm the paths have been appended correctly.
            let expectedPythonPath = customPythonPathToAppend;
            if (typeof mockProcess.env.PYTHONPATH === 'string' && mockProcess.env.PYTHONPATH.length > 0) {
                expectedPythonPath = customPythonPathToAppend + path.delimiter + mockProcess.env.PYTHONPATH;
            }
            chai_1.expect(envVars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH is not correct');
            if (console === 'none') {
                // All variables in current process must be in here
                chai_1.expect(Object.keys(envVars).length).greaterThan(Object.keys(mockProcess.env).length, 'Variables is not a subset');
                Object.keys(mockProcess.env).forEach(key => {
                    if (key === pathVariableName || key === 'PYTHONPATH') {
                        return;
                    }
                    chai_1.expect(mockProcess.env[key]).equal(envVars[key], `Value for the environment variable '${key}' is incorrect.`);
                });
            }
        });
    }
    test('Confirm paths get appended correctly when using json variables and launched in external terminal', () => testAppendingOfPaths('externalTerminal', 6, false));
    test('Confirm paths get appended correctly when using json variables and launched in integrated terminal', () => testAppendingOfPaths('integratedTerminal', 6, false));
    test('Confirm paths get appended correctly when using json variables and launched in debug console', () => __awaiter(this, void 0, void 0, function* () {
        // Add 3 for the 3 new json env variables
        let expectedNumberOfVariables = Object.keys(mockProcess.env).length + 3;
        if (mockProcess.env['PYTHONUNBUFFERED'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        if (mockProcess.env['PYTHONPATH'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        if (mockProcess.env['PYTHONIOENCODING'] === undefined) {
            expectedNumberOfVariables += 1;
        }
        yield testAppendingOfPaths('none', expectedNumberOfVariables, false);
    }));
});
//# sourceMappingURL=envVars.test.js.map