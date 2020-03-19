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
// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this
const chai_1 = require("chai");
const child_process_1 = require("child_process");
const path = require("path");
const vscode_1 = require("vscode");
const async_1 = require("../../../client/common/utils/async");
const contracts_1 = require("../../../client/interpreter/contracts");
const common_1 = require("../../common");
const constants_1 = require("../../constants");
const initialize_1 = require("../../initialize");
const timeoutSecs = 120;
suite('Interpreters - Workspace VirtualEnv Service', function () {
    this.timeout(timeoutSecs * 1000);
    this.retries(0);
    let locator;
    const workspaceUri = constants_1.IS_MULTI_ROOT_TEST ? vscode_1.Uri.file(path.join(initialize_1.multirootPath, 'workspace3')) : common_1.rootWorkspaceUri;
    const workspace4 = vscode_1.Uri.file(path.join(initialize_1.multirootPath, 'workspace4'));
    const venvPrefix = '.venv';
    let serviceContainer;
    function waitForInterpreterToBeDetected(envNameToLookFor) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < timeoutSecs; i += 1) {
                const items = yield locator.getInterpreters(workspaceUri);
                if (items.some(item => item.envName === envNameToLookFor && !item.cachedEntry)) {
                    return;
                }
                yield async_1.sleep(500);
            }
            throw new Error(`${envNameToLookFor}, Environment not detected in the workspace ${workspaceUri.fsPath}`);
        });
    }
    function createVirtualEnvironment(envSuffix) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ensure env is random to avoid conflicts in tests (currupting test data).
            const envName = `${venvPrefix}${envSuffix}${new Date().getTime().toString()}`;
            return new Promise((resolve, reject) => {
                const proc = child_process_1.spawn(common_1.PYTHON_PATH, ['-m', 'venv', envName], { cwd: workspaceUri.fsPath });
                let stdErr = '';
                proc.stderr.on('data', data => stdErr += data.toString());
                proc.on('exit', () => {
                    if (stdErr.length === 0) {
                        return resolve(envName);
                    }
                    const err = new Error(`Failed to create Env ${envName}, ${common_1.PYTHON_PATH}, Error: ${stdErr.toString()}`);
                    reject(err);
                });
            });
        });
    }
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield common_1.isPythonVersionInProcess(undefined, '3'))) {
                return this.skip();
            }
            serviceContainer = (yield initialize_1.initialize()).serviceContainer;
            locator = serviceContainer.get(contracts_1.IInterpreterLocatorService, contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE);
            yield common_1.deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`));
        });
    });
    suiteTeardown(() => common_1.deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`)));
    teardown(() => common_1.deleteFiles(path.join(workspaceUri.fsPath, `${venvPrefix}*`)));
    test('Detect Virtual Environment', () => __awaiter(this, void 0, void 0, function* () {
        const envName = yield createVirtualEnvironment('one');
        yield waitForInterpreterToBeDetected(envName);
    }));
    test('Detect a new Virtual Environment', () => __awaiter(this, void 0, void 0, function* () {
        const env1 = yield createVirtualEnvironment('first');
        yield waitForInterpreterToBeDetected(env1);
        // Ensure second environment in our workspace folder is detected when created.
        const env2 = yield createVirtualEnvironment('second');
        yield waitForInterpreterToBeDetected(env2);
    }));
    test('Detect a new Virtual Environment, and other workspace folder must not be affected (multiroot)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.IS_MULTI_ROOT_TEST) {
                return this.skip();
            }
            // There should be nothing in workspacec4.
            let items4 = yield locator.getInterpreters(workspace4);
            chai_1.expect(items4).to.be.lengthOf(0);
            const [env1, env2] = yield Promise.all([createVirtualEnvironment('first3'), createVirtualEnvironment('second3')]);
            yield Promise.all([waitForInterpreterToBeDetected(env1), waitForInterpreterToBeDetected(env2)]);
            // Workspace4 should still not have any interpreters.
            items4 = yield locator.getInterpreters(workspace4);
            chai_1.expect(items4).to.be.lengthOf(0);
        });
    });
});
//# sourceMappingURL=workspaceVirtualEnvService.test.js.map