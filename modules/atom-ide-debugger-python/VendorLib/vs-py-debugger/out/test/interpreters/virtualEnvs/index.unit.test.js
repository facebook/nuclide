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
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/application/types");
const types_2 = require("../../../client/common/platform/types");
const types_3 = require("../../../client/common/process/types");
const types_4 = require("../../../client/common/terminal/types");
const types_5 = require("../../../client/common/types");
const contracts_1 = require("../../../client/interpreter/contracts");
const virtualEnvs_1 = require("../../../client/interpreter/virtualEnvs");
// tslint:disable-next-line:max-func-body-length
suite('Virtual Environment Manager', () => {
    let process;
    let processService;
    let pathUtils;
    let virtualEnvMgr;
    let fs;
    let workspace;
    let pipEnvService;
    let terminalActivation;
    let platformService;
    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType();
        process = TypeMoq.Mock.ofType();
        processService = TypeMoq.Mock.ofType();
        const processFactory = TypeMoq.Mock.ofType();
        pathUtils = TypeMoq.Mock.ofType();
        fs = TypeMoq.Mock.ofType();
        workspace = TypeMoq.Mock.ofType();
        pipEnvService = TypeMoq.Mock.ofType();
        terminalActivation = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        processService.setup(p => p.then).returns(() => undefined);
        processFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IProcessServiceFactory))).returns(() => processFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_5.ICurrentProcess))).returns(() => process.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_5.IPathUtils))).returns(() => pathUtils.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IFileSystem))).returns(() => fs.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspace.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IPipEnvService))).returns(() => pipEnvService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.ITerminalActivationCommandProvider), TypeMoq.It.isAny())).returns(() => terminalActivation.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IPlatformService), TypeMoq.It.isAny())).returns(() => platformService.object);
        virtualEnvMgr = new virtualEnvs_1.VirtualEnvironmentManager(serviceContainer.object);
    });
    test('Get PyEnv Root from PYENV_ROOT', () => __awaiter(this, void 0, void 0, function* () {
        process
            .setup(p => p.env)
            .returns(() => { return { PYENV_ROOT: 'yes' }; })
            .verifiable(TypeMoq.Times.once());
        const pyenvRoot = yield virtualEnvMgr.getPyEnvRoot();
        process.verifyAll();
        chai_1.expect(pyenvRoot).to.equal('yes');
    }));
    test('Get PyEnv Root from current PYENV_ROOT', () => __awaiter(this, void 0, void 0, function* () {
        process
            .setup(p => p.env)
            .returns(() => { return {}; })
            .verifiable(TypeMoq.Times.once());
        processService
            .setup(p => p.exec(TypeMoq.It.isValue('pyenv'), TypeMoq.It.isValue(['root'])))
            .returns(() => Promise.resolve({ stdout: 'PROC' }))
            .verifiable(TypeMoq.Times.once());
        const pyenvRoot = yield virtualEnvMgr.getPyEnvRoot();
        process.verifyAll();
        processService.verifyAll();
        chai_1.expect(pyenvRoot).to.equal('PROC');
    }));
    test('Get default PyEnv Root path', () => __awaiter(this, void 0, void 0, function* () {
        process
            .setup(p => p.env)
            .returns(() => { return {}; })
            .verifiable(TypeMoq.Times.once());
        processService
            .setup(p => p.exec(TypeMoq.It.isValue('pyenv'), TypeMoq.It.isValue(['root'])))
            .returns(() => Promise.resolve({ stdout: '', stderr: 'err' }))
            .verifiable(TypeMoq.Times.once());
        pathUtils
            .setup(p => p.home)
            .returns(() => 'HOME')
            .verifiable(TypeMoq.Times.once());
        const pyenvRoot = yield virtualEnvMgr.getPyEnvRoot();
        process.verifyAll();
        processService.verifyAll();
        chai_1.expect(pyenvRoot).to.equal(path.join('HOME', '.pyenv'));
    }));
    test('Get Environment Type, detects venv', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b', 'c', 'python');
        const dir = path.dirname(pythonPath);
        fs.setup(f => f.fileExists(TypeMoq.It.isValue(path.join(dir, 'pyvenv.cfg'))))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        const isRecognized = yield virtualEnvMgr.isVenvEnvironment(pythonPath);
        chai_1.expect(isRecognized).to.be.equal(true, 'invalid value');
        fs.verifyAll();
    }));
    test('Get Environment Type, does not detect venv incorrectly', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b', 'c', 'python');
        const dir = path.dirname(pythonPath);
        fs.setup(f => f.fileExists(TypeMoq.It.isValue(path.join(dir, 'pyvenv.cfg'))))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        const isRecognized = yield virtualEnvMgr.isVenvEnvironment(pythonPath);
        chai_1.expect(isRecognized).to.be.equal(false, 'invalid value');
        fs.verifyAll();
    }));
    test('Get Environment Type, detects pyenv', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('py-env-root', 'b', 'c', 'python');
        process.setup(p => p.env)
            .returns(() => {
            return { PYENV_ROOT: path.join('py-env-root', 'b') };
        })
            .verifiable(TypeMoq.Times.once());
        const isRecognized = yield virtualEnvMgr.isPyEnvEnvironment(pythonPath);
        chai_1.expect(isRecognized).to.be.equal(true, 'invalid value');
        process.verifyAll();
    }));
    test('Get Environment Type, does not detect pyenv incorrectly', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('a', 'b', 'c', 'python');
        process.setup(p => p.env)
            .returns(() => {
            return { PYENV_ROOT: path.join('py-env-root', 'b') };
        })
            .verifiable(TypeMoq.Times.once());
        const isRecognized = yield virtualEnvMgr.isPyEnvEnvironment(pythonPath);
        chai_1.expect(isRecognized).to.be.equal(false, 'invalid value');
        process.verifyAll();
    }));
    test('Get Environment Type, detects pipenv', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('x', 'b', 'c', 'python');
        workspace
            .setup(w => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const ws = [{ uri: vscode_1.Uri.file('x') }];
        workspace
            .setup(w => w.workspaceFolders)
            .returns(() => ws)
            .verifiable(TypeMoq.Times.atLeastOnce());
        pipEnvService
            .setup(p => p.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        const isRecognized = yield virtualEnvMgr.isPipEnvironment(pythonPath);
        chai_1.expect(isRecognized).to.be.equal(true, 'invalid value');
        workspace.verifyAll();
        pipEnvService.verifyAll();
    }));
    test('Get Environment Type, does not detect pipenv incorrectly', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('x', 'b', 'c', 'python');
        workspace
            .setup(w => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const ws = [{ uri: vscode_1.Uri.file('x') }];
        workspace
            .setup(w => w.workspaceFolders)
            .returns(() => ws)
            .verifiable(TypeMoq.Times.atLeastOnce());
        pipEnvService
            .setup(p => p.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        const isRecognized = yield virtualEnvMgr.isPipEnvironment(pythonPath);
        chai_1.expect(isRecognized).to.be.equal(false, 'invalid value');
        workspace.verifyAll();
        pipEnvService.verifyAll();
    }));
    for (const isWindows of [true, false]) {
        const testTitleSuffix = `(${isWindows ? 'On Windows' : 'Non-Windows'}})`;
        test(`Get Environment Type, detects virtualenv ${testTitleSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            const pythonPath = path.join('x', 'b', 'c', 'python');
            terminalActivation
                .setup(t => t.isShellSupported(TypeMoq.It.isAny()))
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
            terminalActivation
                .setup(t => t.getActivationCommandsForInterpreter(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(['1']))
                .verifiable(TypeMoq.Times.atLeastOnce());
            const isRecognized = yield virtualEnvMgr.isVirtualEnvironment(pythonPath);
            chai_1.expect(isRecognized).to.be.equal(true, 'invalid value');
            terminalActivation.verifyAll();
        }));
        test(`Get Environment Type, does not detect virtualenv incorrectly ${testTitleSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            const pythonPath = path.join('x', 'b', 'c', 'python');
            terminalActivation
                .setup(t => t.isShellSupported(TypeMoq.It.isAny()))
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
            terminalActivation
                .setup(t => t.getActivationCommandsForInterpreter(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve([]))
                .verifiable(TypeMoq.Times.atLeastOnce());
            let isRecognized = yield virtualEnvMgr.isVirtualEnvironment(pythonPath);
            chai_1.expect(isRecognized).to.be.equal(false, 'invalid value');
            terminalActivation.verifyAll();
            terminalActivation.reset();
            terminalActivation
                .setup(t => t.isShellSupported(TypeMoq.It.isAny()))
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            terminalActivation
                .setup(t => t.getActivationCommandsForInterpreter(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve([]))
                .verifiable(TypeMoq.Times.never());
            isRecognized = yield virtualEnvMgr.isVirtualEnvironment(pythonPath);
            chai_1.expect(isRecognized).to.be.equal(false, 'invalid value');
            terminalActivation.verifyAll();
        }));
    }
    test('Get Environment Type, does not detect the type', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('x', 'b', 'c', 'python');
        virtualEnvMgr.isPipEnvironment = () => Promise.resolve(false);
        virtualEnvMgr.isPyEnvEnvironment = () => Promise.resolve(false);
        virtualEnvMgr.isVenvEnvironment = () => Promise.resolve(false);
        virtualEnvMgr.isVirtualEnvironment = () => Promise.resolve(false);
        const envType = yield virtualEnvMgr.getEnvironmentType(pythonPath);
        chai_1.expect(envType).to.be.equal(contracts_1.InterpreterType.Unknown);
    }));
});
//# sourceMappingURL=index.unit.test.js.map