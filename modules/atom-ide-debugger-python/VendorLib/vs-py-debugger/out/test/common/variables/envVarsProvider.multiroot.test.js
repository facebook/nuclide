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
const fs = require("fs-extra");
const os_1 = require("os");
const path = require("path");
const vscode_1 = require("vscode");
const constants_1 = require("../../../client/common/platform/constants");
const types_1 = require("../../../client/common/types");
const util_1 = require("../../../client/common/util");
const async_1 = require("../../../client/common/utils/async");
const environment_1 = require("../../../client/common/variables/environment");
const environmentVariablesProvider_1 = require("../../../client/common/variables/environmentVariablesProvider");
const common_1 = require("../../common");
const initialize_1 = require("../../initialize");
const process_1 = require("../../mocks/process");
const serviceRegistry_1 = require("../../unittests/serviceRegistry");
chai_1.use(chaiAsPromised);
const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace4Path = vscode_1.Uri.file(path.join(multirootPath, 'workspace4'));
const workspace4PyFile = vscode_1.Uri.file(path.join(workspace4Path.fsPath, 'one.py'));
// tslint:disable-next-line:max-func-body-length
suite('Multiroot Environment Variables Provider', () => {
    let ioc;
    const pathVariableName = util_1.IS_WINDOWS ? constants_1.WINDOWS_PATH_VARIABLE_NAME : constants_1.NON_WINDOWS_PATH_VARIABLE_NAME;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!initialize_1.IS_MULTI_ROOT_TEST) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            yield common_1.clearPythonPathInWorkspaceFolder(workspace4Path);
            yield common_1.updateSetting('envFile', undefined, workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
            yield initialize_1.initialize();
        });
    });
    setup(() => {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        return initialize_1.initializeTest();
    });
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield initialize_1.closeActiveWindows();
        yield common_1.clearPythonPathInWorkspaceFolder(workspace4Path);
        yield common_1.updateSetting('envFile', undefined, workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        yield initialize_1.initializeTest();
    }));
    function getVariablesProvider(mockVariables = Object.assign({}, process.env)) {
        const pathUtils = ioc.serviceContainer.get(types_1.IPathUtils);
        const mockProcess = new process_1.MockProcess(mockVariables);
        const variablesService = new environment_1.EnvironmentVariablesService(pathUtils);
        const disposables = ioc.serviceContainer.get(types_1.IDisposableRegistry);
        const isWindows = ioc.serviceContainer.get(types_1.IsWindows);
        return new environmentVariablesProvider_1.EnvironmentVariablesProvider(variablesService, disposables, isWindows, mockProcess);
    }
    test('Custom variables should not be undefined without an env file', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('envFile', 'someInvalidFile.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const envProvider = getVariablesProvider();
        const vars = envProvider.getEnvironmentVariables(workspace4PyFile);
        yield chai_1.expect(vars).to.eventually.not.equal(undefined, 'Variables is not undefiend');
    }));
    test('Custom variables should be parsed from env file', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    }));
    test('All process environment variables should be included in variables returned', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
        Object.keys(processVariables).forEach(variable => {
            chai_1.expect(vars).to.have.property(variable, processVariables[variable], 'Value of the variable is incorrect');
        });
    }));
    test('Variables from file should take precedence over variables in process', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        processVariables.X1234PYEXTUNITTESTVAR = 'abcd';
        processVariables.ABCD = 'abcd';
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('ABCD', 'abcd', 'ABCD value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    }));
    test('PYTHONPATH from process variables should be merged with that in env file', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        processVariables.PYTHONPATH = '/usr/one/TWO';
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        const expectedPythonPath = `../workspace5${path.delimiter}${processVariables.PYTHONPATH}`;
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
    }));
    test('PATH from process variables should be included in in variables returned (mock variables)', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        processVariables.PYTHONPATH = '/usr/one/TWO';
        processVariables[pathVariableName] = '/usr/one/THREE';
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        const expectedPythonPath = `../workspace5${path.delimiter}${processVariables.PYTHONPATH}`;
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        chai_1.expect(vars).to.have.property(pathVariableName, processVariables[pathVariableName], 'PATH value is invalid');
    }));
    test('PATH from process variables should be included in in variables returned', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        processVariables.PYTHONPATH = '/usr/one/TWO';
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        const expectedPythonPath = `../workspace5${path.delimiter}${processVariables.PYTHONPATH}`;
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        chai_1.expect(vars).to.have.property(pathVariableName, processVariables[pathVariableName], 'PATH value is invalid');
    }));
    test('PYTHONPATH and PATH from process variables should be merged with that in env file', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env5', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        processVariables.PYTHONPATH = '/usr/one/TWO';
        processVariables[pathVariableName] = '/usr/one/THREE';
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        const expectedPythonPath = `/usr/one/three:/usr/one/four${path.delimiter}${processVariables.PYTHONPATH}`;
        const expectedPath = `/usr/x:/usr/y${path.delimiter}${processVariables[pathVariableName]}`;
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X', '1', 'X value is invalid');
        chai_1.expect(vars).to.have.property('Y', '2', 'Y value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        chai_1.expect(vars).to.have.property(pathVariableName, expectedPath, 'PATH value is invalid');
    }));
    test('PATH and PYTHONPATH from env file should be returned as is', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env5', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        if (processVariables[pathVariableName]) {
            delete processVariables[pathVariableName];
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        const expectedPythonPath = '/usr/one/three:/usr/one/four';
        const expectedPath = '/usr/x:/usr/y';
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X', '1', 'X value is invalid');
        chai_1.expect(vars).to.have.property('Y', '2', 'Y value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', expectedPythonPath, 'PYTHONPATH value is invalid');
        chai_1.expect(vars).to.have.property(pathVariableName, expectedPath, 'PATH value is invalid');
    }));
    test('PYTHONPATH and PATH from process variables should be included in variables returned', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env2', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        processVariables.PYTHONPATH = '/usr/one/TWO';
        processVariables[pathVariableName] = '/usr/one/THREE';
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', processVariables.PYTHONPATH, 'PYTHONPATH value is invalid');
        chai_1.expect(vars).to.have.property(pathVariableName, processVariables[pathVariableName], 'PATH value is invalid');
    }));
    test('PYTHONPATH should not exist in variables returned', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env2', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        processVariables[pathVariableName] = '/usr/one/THREE';
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.not.have.property('PYTHONPATH');
        chai_1.expect(vars).to.have.property(pathVariableName, processVariables[pathVariableName], 'PATH value is invalid');
    }));
    test('Custom variables should not be merged with process environment varaibles', () => __awaiter(this, void 0, void 0, function* () {
        const randomEnvVariable = `UNIT_TEST_PYTHON_EXT_RANDOM_VARIABLE_${new Date().getSeconds()}`;
        const processVariables = Object.assign({}, process.env);
        processVariables[randomEnvVariable] = '1234';
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
        chai_1.expect(vars).to.not.to.have.property(randomEnvVariable, undefined, 'Yikes process variable has leaked');
    }));
    test('Custom variables should be merged with process environment varaibles', () => __awaiter(this, void 0, void 0, function* () {
        const randomEnvVariable = `UNIT_TEST_PYTHON_EXT_RANDOM_VARIABLE_${new Date().getSeconds()}`;
        const processVariables = Object.assign({}, process.env);
        processVariables[randomEnvVariable] = '1234';
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
        chai_1.expect(vars).to.have.property(randomEnvVariable, '1234', 'Yikes process variable has leaked');
    }));
    test('Custom variables will be refreshed when settings points to a different env file', () => __awaiter(this, void 0, void 0, function* () {
        // tslint:disable-next-line:no-invalid-template-strings
        yield common_1.updateSetting('envFile', '${workspaceRoot}/.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const processVariables = Object.assign({}, process.env);
        if (processVariables.PYTHONPATH) {
            delete processVariables.PYTHONPATH;
        }
        const envProvider = getVariablesProvider(processVariables);
        const vars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(vars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(vars).to.have.property('X1234PYEXTUNITTESTVAR', '1234', 'X1234PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(vars).to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
        const settings = vscode_1.workspace.getConfiguration('python', workspace4PyFile);
        // tslint:disable-next-line:no-invalid-template-strings
        yield settings.update('envFile', '${workspaceRoot}/.env2', vscode_1.ConfigurationTarget.WorkspaceFolder);
        // Wait for settings to get refreshed.
        yield new Promise(resolve => setTimeout(resolve, 5000));
        const newVars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
        chai_1.expect(newVars).to.not.equal(undefined, 'Variables is is undefiend');
        chai_1.expect(newVars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid');
        chai_1.expect(newVars).to.not.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid');
    }));
    test('Custom variables will be refreshed when .env file is created, modified and deleted', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(20000);
            const env3 = path.join(workspace4Path.fsPath, '.env3');
            const fileExists = yield fs.pathExists(env3);
            if (fileExists) {
                yield fs.remove(env3);
            }
            // tslint:disable-next-line:no-invalid-template-strings
            yield common_1.updateSetting('envFile', '${workspaceRoot}/.env3', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
            const processVariables = Object.assign({}, process.env);
            if (processVariables.PYTHONPATH) {
                delete processVariables.PYTHONPATH;
            }
            const envProvider = getVariablesProvider(processVariables);
            const vars = envProvider.getEnvironmentVariables(workspace4PyFile);
            yield chai_1.expect(vars).to.eventually.not.equal(undefined, 'Variables is is undefiend');
            // Create env3.
            const contents = fs.readFileSync(path.join(workspace4Path.fsPath, '.env2'));
            fs.writeFileSync(env3, contents);
            // Wait for settings to get refreshed.
            yield new Promise(resolve => setTimeout(resolve, 5000));
            const newVars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
            chai_1.expect(newVars).to.not.equal(undefined, 'Variables is is undefiend after creating');
            chai_1.expect(newVars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid after creating');
            chai_1.expect(newVars).to.not.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid after creating');
            // Modify env3.
            fs.writeFileSync(env3, `${contents}${os_1.EOL}X123456PYEXTUNITTESTVAR=123456`);
            // Wait for settings to get refreshed.
            yield new Promise(resolve => setTimeout(resolve, 5000));
            const updatedVars = yield envProvider.getEnvironmentVariables(workspace4PyFile);
            chai_1.expect(updatedVars).to.not.equal(undefined, 'Variables is is undefiend after modifying');
            chai_1.expect(updatedVars).to.have.property('X12345PYEXTUNITTESTVAR', '12345', 'X12345PYEXTUNITTESTVAR value is invalid after modifying');
            chai_1.expect(updatedVars).to.not.to.have.property('PYTHONPATH', '../workspace5', 'PYTHONPATH value is invalid after modifying');
            chai_1.expect(updatedVars).to.have.property('X123456PYEXTUNITTESTVAR', '123456', 'X123456PYEXTUNITTESTVAR value is invalid after modifying');
            // Now remove env3.
            yield fs.remove(env3);
            // Wait for settings to get refreshed.
            yield new Promise(resolve => setTimeout(resolve, 5000));
            const varsAfterDeleting = yield envProvider.getEnvironmentVariables(workspace4PyFile);
            chai_1.expect(varsAfterDeleting).to.not.equal(undefined, 'Variables is undefiend after deleting');
        });
    });
    test('Change event will be raised when when .env file is created, modified and deleted', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // tslint:disable-next-line:no-invalid-this
            this.timeout(20000);
            const env3 = path.join(workspace4Path.fsPath, '.env3');
            const fileExists = yield fs.pathExists(env3);
            if (fileExists) {
                yield fs.remove(env3);
            }
            // tslint:disable-next-line:no-invalid-template-strings
            yield common_1.updateSetting('envFile', '${workspaceRoot}/.env3', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
            const processVariables = Object.assign({}, process.env);
            if (processVariables.PYTHONPATH) {
                delete processVariables.PYTHONPATH;
            }
            const envProvider = getVariablesProvider(processVariables);
            let eventRaisedPromise = async_1.createDeferred();
            envProvider.onDidEnvironmentVariablesChange(() => eventRaisedPromise.resolve(true));
            const vars = envProvider.getEnvironmentVariables(workspace4PyFile);
            yield chai_1.expect(vars).to.eventually.not.equal(undefined, 'Variables is is undefiend');
            // Create env3.
            const contents = fs.readFileSync(path.join(workspace4Path.fsPath, '.env2'));
            fs.writeFileSync(env3, contents);
            // Wait for settings to get refreshed.
            yield new Promise(resolve => setTimeout(resolve, 5000));
            let eventRaised = yield eventRaisedPromise.promise;
            chai_1.expect(eventRaised).to.equal(true, 'Create notification not raised');
            // Modify env3.
            eventRaisedPromise = async_1.createDeferred();
            fs.writeFileSync(env3, `${contents}${os_1.EOL}X123456PYEXTUNITTESTVAR=123456`);
            // Wait for settings to get refreshed.
            yield new Promise(resolve => setTimeout(resolve, 5000));
            eventRaised = yield eventRaisedPromise.promise;
            chai_1.expect(eventRaised).to.equal(true, 'Change notification not raised');
            // Now remove env3.
            eventRaisedPromise = async_1.createDeferred();
            yield fs.remove(env3);
            // Wait for settings to get refreshed.
            yield new Promise(resolve => setTimeout(resolve, 5000));
            eventRaised = yield eventRaisedPromise.promise;
            chai_1.expect(eventRaised).to.equal(true, 'Delete notification not raised');
        });
    });
});
//# sourceMappingURL=envVarsProvider.multiroot.test.js.map