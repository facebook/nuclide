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
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const path = require("path");
const pathUtils_1 = require("../../../client/common/platform/pathUtils");
const platform_1 = require("../../../client/common/utils/platform");
const environment_1 = require("../../../client/common/variables/environment");
chai_1.use(chaiAsPromised);
const envFilesFolderPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc', 'workspace4');
// tslint:disable-next-line:max-func-body-length
suite('Environment Variables Service', () => {
    let pathUtils;
    let variablesService;
    setup(() => {
        pathUtils = new pathUtils_1.PathUtils(platform_1.isWindows());
        variablesService = new environment_1.EnvironmentVariablesService(pathUtils);
    });
    test('Custom variables should be undefined with non-existent files', () => __awaiter(this, void 0, void 0, function* () {
        const vars = yield variablesService.parseFile(path.join(envFilesFolderPath, 'abcd'));
        chai_1.expect(vars).to.equal(undefined, 'Variables should be undefined');
    }));
    test('Custom variables should be undefined when folder name is passed instead of a file name', () => __awaiter(this, void 0, void 0, function* () {
        const vars = yield variablesService.parseFile(envFilesFolderPath);
        chai_1.expect(vars).to.equal(undefined, 'Variables should be undefined');
    }));
    test('Custom variables should be not undefined with a valid environment file', () => __awaiter(this, void 0, void 0, function* () {
        const vars = yield variablesService.parseFile(path.join(envFilesFolderPath, '.env'));
        chai_1.expect(vars).to.not.equal(undefined, 'Variables should be undefined');
    }));
    test('Custom variables should be parsed from env file', () => __awaiter(this, void 0, void 0, function* () {
        const vars = yield variablesService.parseFile(path.join(envFilesFolderPath, '.env'));
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    }));
    test('PATH and PYTHONPATH from env file should be returned as is', () => __awaiter(this, void 0, void 0, function* () {
        const vars = yield variablesService.parseFile(path.join(envFilesFolderPath, '.env5'));
        const expectedPythonPath = '/usr/one/three:/usr/one/four';
        const expectedPath = '/usr/x:/usr/y';
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(Object.keys(vars)).lengthOf(5, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('X', '1', 'X value is invalid');
        chai_1.expect(vars).to.have.property('Y', '2', 'Y value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        chai_1.expect(vars).to.have.property('PATH', expectedPath, 'PATH value is invalid');
    }));
    test('Ensure variables are merged', () => __awaiter(this, void 0, void 0, function* () {
        const vars1 = { ONE: '1', TWO: 'TWO' };
        const vars2 = { ONE: 'ONE', THREE: '3' };
        variablesService.mergeVariables(vars1, vars2);
        chai_1.expect(Object.keys(vars1)).lengthOf(2, 'Source variables modified');
        chai_1.expect(Object.keys(vars2)).lengthOf(3, 'Variables not merged');
        chai_1.expect(vars2).to.have.property('ONE', 'ONE', 'Variable overwritten');
        chai_1.expect(vars2).to.have.property('TWO', 'TWO', 'Incorrect value');
        chai_1.expect(vars2).to.have.property('THREE', '3', 'Variable not merged');
    }));
    test('Ensure path variabnles variables are not merged into target', () => __awaiter(this, void 0, void 0, function* () {
        const pathVariable = pathUtils.getPathVariableName();
        const vars1 = { ONE: '1', TWO: 'TWO', PYTHONPATH: 'PYTHONPATH' };
        vars1[pathVariable] = 'PATH';
        const vars2 = { ONE: 'ONE', THREE: '3' };
        variablesService.mergeVariables(vars1, vars2);
        chai_1.expect(Object.keys(vars1)).lengthOf(4, 'Source variables modified');
        chai_1.expect(Object.keys(vars2)).lengthOf(3, 'Variables not merged');
        chai_1.expect(vars2).to.have.property('ONE', 'ONE', 'Variable overwritten');
        chai_1.expect(vars2).to.have.property('TWO', 'TWO', 'Incorrect value');
        chai_1.expect(vars2).to.have.property('THREE', '3', 'Variable not merged');
    }));
    test('Ensure path variabnles variables in target are left untouched', () => __awaiter(this, void 0, void 0, function* () {
        const pathVariable = pathUtils.getPathVariableName();
        const vars1 = { ONE: '1', TWO: 'TWO' };
        const vars2 = { ONE: 'ONE', THREE: '3', PYTHONPATH: 'PYTHONPATH' };
        vars2[pathVariable] = 'PATH';
        variablesService.mergeVariables(vars1, vars2);
        chai_1.expect(Object.keys(vars1)).lengthOf(2, 'Source variables modified');
        chai_1.expect(Object.keys(vars2)).lengthOf(5, 'Variables not merged');
        chai_1.expect(vars2).to.have.property('ONE', 'ONE', 'Variable overwritten');
        chai_1.expect(vars2).to.have.property('TWO', 'TWO', 'Incorrect value');
        chai_1.expect(vars2).to.have.property('THREE', '3', 'Variable not merged');
        chai_1.expect(vars2).to.have.property('PYTHONPATH', 'PYTHONPATH', 'Incorrect value');
        chai_1.expect(vars2).to.have.property(pathVariable, 'PATH', 'Incorrect value');
    }));
    test('Ensure appending PATH has no effect if an undefined value or empty string is provided and PATH does not exist in vars object', () => __awaiter(this, void 0, void 0, function* () {
        const vars = { ONE: '1' };
        variablesService.appendPath(vars);
        chai_1.expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        variablesService.appendPath(vars, '');
        chai_1.expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        variablesService.appendPath(vars, ' ', '');
        chai_1.expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
    }));
    test('Ensure appending PYTHONPATH has no effect if an undefined value or empty string is provided and PYTHONPATH does not exist in vars object', () => __awaiter(this, void 0, void 0, function* () {
        const vars = { ONE: '1' };
        variablesService.appendPythonPath(vars);
        chai_1.expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        variablesService.appendPythonPath(vars, '');
        chai_1.expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        variablesService.appendPythonPath(vars, ' ', '');
        chai_1.expect(Object.keys(vars)).lengthOf(1, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
    }));
    test('Ensure appending PATH has no effect if an empty string is provided and path does not exist in vars object', () => __awaiter(this, void 0, void 0, function* () {
        const pathVariable = pathUtils.getPathVariableName();
        const vars = { ONE: '1' };
        vars[pathVariable] = 'PATH';
        variablesService.appendPath(vars);
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        chai_1.expect(vars).to.have.property(pathVariable, 'PATH', 'Incorrect value');
        variablesService.appendPath(vars, '');
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        chai_1.expect(vars).to.have.property(pathVariable, 'PATH', 'Incorrect value');
        variablesService.appendPath(vars, ' ', '');
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        chai_1.expect(vars).to.have.property(pathVariable, 'PATH', 'Incorrect value');
    }));
    test('Ensure appending PYTHONPATH has no effect if an empty string is provided and PYTHONPATH does not exist in vars object', () => __awaiter(this, void 0, void 0, function* () {
        const vars = { ONE: '1', PYTHONPATH: 'PYTHONPATH' };
        variablesService.appendPythonPath(vars);
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        chai_1.expect(vars).to.have.property('PYTHONPATH', 'PYTHONPATH', 'Incorrect value');
        variablesService.appendPythonPath(vars, '');
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        chai_1.expect(vars).to.have.property('PYTHONPATH', 'PYTHONPATH', 'Incorrect value');
        variablesService.appendPythonPath(vars, ' ', '');
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        chai_1.expect(vars).to.have.property('PYTHONPATH', 'PYTHONPATH', 'Incorrect value');
    }));
    test('Ensure PATH is appeneded', () => __awaiter(this, void 0, void 0, function* () {
        const pathVariable = pathUtils.getPathVariableName();
        const vars = { ONE: '1' };
        vars[pathVariable] = 'PATH';
        const pathToAppend = `/usr/one${path.delimiter}/usr/three`;
        variablesService.appendPath(vars, pathToAppend);
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        chai_1.expect(vars).to.have.property(pathVariable, `PATH${path.delimiter}${pathToAppend}`, 'Incorrect value');
    }));
    test('Ensure appending PYTHONPATH has no effect if an empty string is provided and PYTHONPATH does not exist in vars object', () => __awaiter(this, void 0, void 0, function* () {
        const vars = { ONE: '1', PYTHONPATH: 'PYTHONPATH' };
        const pathToAppend = `/usr/one${path.delimiter}/usr/three`;
        variablesService.appendPythonPath(vars, pathToAppend);
        chai_1.expect(Object.keys(vars)).lengthOf(2, 'Incorrect number of variables');
        chai_1.expect(vars).to.have.property('ONE', '1', 'Incorrect value');
        chai_1.expect(vars).to.have.property('PYTHONPATH', `PYTHONPATH${path.delimiter}${pathToAppend}`, 'Incorrect value');
    }));
});
//# sourceMappingURL=envVarsService.test.js.map