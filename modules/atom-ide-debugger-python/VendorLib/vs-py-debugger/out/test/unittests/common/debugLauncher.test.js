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
// tslint:disable:no-any
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/application/types");
const constants_1 = require("../../../client/common/constants");
require("../../../client/common/extensions");
const types_2 = require("../../../client/common/types");
const constants_2 = require("../../../client/debugger/constants");
const types_3 = require("../../../client/debugger/types");
const debugLauncher_1 = require("../../../client/unittests/common/debugLauncher");
chai_1.use(chaiAsPromised);
// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - Debug Launcher', () => {
    let unitTestSettings;
    let debugLauncher;
    let debugService;
    let workspaceService;
    let settings;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        const serviceContainer = TypeMoq.Mock.ofType();
        const configService = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IConfigurationService))).returns(() => configService.object);
        debugService = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IDebugService))).returns(() => debugService.object);
        workspaceService = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
        settings = TypeMoq.Mock.ofType();
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        unitTestSettings = TypeMoq.Mock.ofType();
        settings.setup(p => p.unitTest).returns(() => unitTestSettings.object);
        debugLauncher = new debugLauncher_1.DebugLauncher(serviceContainer.object);
    }));
    function setupDebugManager(workspaceFolder, name, type, request, program, cwd, args, console, debugOptions, testProvider) {
        const envFile = __filename;
        settings.setup(p => p.envFile).returns(() => envFile);
        const debugArgs = testProvider === 'unittest' ? args.filter(item => item !== '--debug') : args;
        debugService.setup(d => d.startDebugging(TypeMoq.It.isValue(workspaceFolder), TypeMoq.It.isObjectWith({ name, type, request, program, cwd, args: debugArgs, console, envFile, debugOptions })))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
    }
    function createWorkspaceFolder(folderPath) {
        return { index: 0, name: path.basename(folderPath), uri: vscode_1.Uri.file(folderPath) };
    }
    function getTestLauncherScript(testProvider) {
        switch (testProvider) {
            case 'unittest': {
                return path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
            }
            case 'pytest':
            case 'nosetest': {
                return path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'testlauncher.py');
            }
            default: {
                throw new Error(`Unknown test provider '${testProvider}'`);
            }
        }
    }
    const testProviders = ['nosetest', 'pytest', 'unittest'];
    testProviders.forEach(testProvider => {
        const testTitleSuffix = `(Test Framework '${testProvider}')`;
        const testLaunchScript = getTestLauncherScript(testProvider);
        const debuggerType = constants_2.DebuggerTypeName;
        test(`Must launch debugger ${testTitleSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            workspaceService.setup(u => u.hasWorkspaceFolders).returns(() => true);
            const workspaceFolders = [createWorkspaceFolder('one/two/three'), createWorkspaceFolder('five/six/seven')];
            workspaceService.setup(u => u.workspaceFolders).returns(() => workspaceFolders);
            workspaceService.setup(u => u.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolders[0]);
            const args = ['/one/two/three/testfile.py'];
            const cwd = workspaceFolders[0].uri.fsPath;
            const program = testLaunchScript;
            setupDebugManager(workspaceFolders[0], 'Debug Unit Test', debuggerType, 'launch', program, cwd, args, 'none', [types_3.DebugOptions.RedirectOutput], testProvider);
            debugLauncher.launchDebugger({ cwd, args, testProvider }).ignoreErrors();
            debugService.verifyAll();
        }));
        test(`Must launch debugger with arguments ${testTitleSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            workspaceService.setup(u => u.hasWorkspaceFolders).returns(() => true);
            const workspaceFolders = [createWorkspaceFolder('one/two/three'), createWorkspaceFolder('five/six/seven')];
            workspaceService.setup(u => u.workspaceFolders).returns(() => workspaceFolders);
            workspaceService.setup(u => u.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolders[0]);
            const args = ['/one/two/three/testfile.py', '--debug', '1'];
            const cwd = workspaceFolders[0].uri.fsPath;
            const program = testLaunchScript;
            setupDebugManager(workspaceFolders[0], 'Debug Unit Test', debuggerType, 'launch', program, cwd, args, 'none', [types_3.DebugOptions.RedirectOutput], testProvider);
            debugLauncher.launchDebugger({ cwd, args, testProvider }).ignoreErrors();
            debugService.verifyAll();
        }));
        test(`Must not launch debugger if cancelled ${testTitleSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            workspaceService.setup(u => u.hasWorkspaceFolders).returns(() => true);
            debugService.setup(d => d.startDebugging(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            const cancellationToken = new vscode_1.CancellationTokenSource();
            cancellationToken.cancel();
            const token = cancellationToken.token;
            yield chai_1.expect(debugLauncher.launchDebugger({ cwd: '', args: [], token, testProvider })).to.be.eventually.equal(undefined, 'not undefined');
            debugService.verifyAll();
        }));
        test(`Must throw an exception if there are no workspaces ${testTitleSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            workspaceService.setup(u => u.hasWorkspaceFolders).returns(() => false);
            debugService.setup(d => d.startDebugging(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            yield chai_1.expect(debugLauncher.launchDebugger({ cwd: '', args: [], testProvider })).to.eventually.rejectedWith('Please open a workspace');
            debugService.verifyAll();
        }));
    });
});
//# sourceMappingURL=debugLauncher.test.js.map