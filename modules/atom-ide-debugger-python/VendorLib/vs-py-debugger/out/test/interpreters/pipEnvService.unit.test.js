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
// tslint:disable:max-func-body-length no-any
const chai_1 = require("chai");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/process/types");
const types_4 = require("../../client/common/types");
const enum_1 = require("../../client/common/utils/enum");
const types_5 = require("../../client/common/variables/types");
const contracts_1 = require("../../client/interpreter/contracts");
const pipEnvService_1 = require("../../client/interpreter/locators/services/pipEnvService");
var OS;
(function (OS) {
    OS[OS["Mac"] = 0] = "Mac";
    OS[OS["Windows"] = 1] = "Windows";
    OS[OS["Linux"] = 2] = "Linux";
})(OS || (OS = {}));
suite('Interpreters - PipEnv', () => {
    const rootWorkspace = vscode_1.Uri.file(path.join('usr', 'desktop', 'wkspc1')).fsPath;
    enum_1.getNamesAndValues(OS).forEach(os => {
        [undefined, vscode_1.Uri.file(path.join(rootWorkspace, 'one.py'))].forEach(resource => {
            const testSuffix = ` (${os.name}, ${resource ? 'with' : 'without'} a workspace)`;
            let pipEnvService;
            let serviceContainer;
            let interpreterHelper;
            let processService;
            let currentProcess;
            let fileSystem;
            let appShell;
            let persistentStateFactory;
            let envVarsProvider;
            let procServiceFactory;
            let logger;
            let platformService;
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType();
                const workspaceService = TypeMoq.Mock.ofType();
                interpreterHelper = TypeMoq.Mock.ofType();
                fileSystem = TypeMoq.Mock.ofType();
                processService = TypeMoq.Mock.ofType();
                appShell = TypeMoq.Mock.ofType();
                currentProcess = TypeMoq.Mock.ofType();
                persistentStateFactory = TypeMoq.Mock.ofType();
                envVarsProvider = TypeMoq.Mock.ofType();
                procServiceFactory = TypeMoq.Mock.ofType();
                logger = TypeMoq.Mock.ofType();
                platformService = TypeMoq.Mock.ofType();
                processService.setup((x) => x.then).returns(() => undefined);
                procServiceFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
                // tslint:disable-next-line:no-any
                const persistentState = TypeMoq.Mock.ofType();
                persistentStateFactory.setup(p => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => persistentState.object);
                persistentStateFactory.setup(p => p.createWorkspacePersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => persistentState.object);
                persistentState.setup(p => p.value).returns(() => undefined);
                persistentState.setup(p => p.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
                const workspaceFolder = TypeMoq.Mock.ofType();
                workspaceFolder.setup(w => w.uri).returns(() => vscode_1.Uri.file(rootWorkspace));
                workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                workspaceService.setup(w => w.rootPath).returns(() => rootWorkspace);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IProcessServiceFactory), TypeMoq.It.isAny())).returns(() => procServiceFactory.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IInterpreterHelper))).returns(() => interpreterHelper.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.ICurrentProcess))).returns(() => currentProcess.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IFileSystem))).returns(() => fileSystem.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IApplicationShell))).returns(() => appShell.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.IPersistentStateFactory))).returns(() => persistentStateFactory.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_5.IEnvironmentVariablesProvider))).returns(() => envVarsProvider.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.ILogger))).returns(() => logger.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IPlatformService))).returns(() => platformService.object);
                pipEnvService = new pipEnvService_1.PipEnvService(serviceContainer.object);
            });
            test(`Should return an empty list'${testSuffix}`, () => {
                const environments = pipEnvService.getInterpreters(resource);
                chai_1.expect(environments).to.be.eventually.deep.equal([]);
            });
            test(`Should return an empty list if there is no \'PipFile\'${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const env = {};
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.once());
                const environments = yield pipEnvService.getInterpreters(resource);
                chai_1.expect(environments).to.be.deep.equal([]);
                fileSystem.verifyAll();
            }));
            test(`Should display warning message if there is a \'PipFile\' but \'pipenv --venv\' failes ${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const env = {};
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.reject(''));
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true));
                appShell.setup(a => a.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('')).verifiable(TypeMoq.Times.once());
                logger.setup(l => l.logWarning(TypeMoq.It.isAny(), TypeMoq.It.isAny())).verifiable(TypeMoq.Times.exactly(2));
                const environments = yield pipEnvService.getInterpreters(resource);
                chai_1.expect(environments).to.be.deep.equal([]);
                appShell.verifyAll();
                logger.verifyAll();
            }));
            test(`Should display warning message if there is a \'PipFile\' but \'pipenv --venv\' failes with stderr ${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const env = {};
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stderr: 'PipEnv Failed', stdout: '' }));
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true));
                appShell.setup(a => a.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('')).verifiable(TypeMoq.Times.once());
                logger.setup(l => l.logWarning(TypeMoq.It.isAny(), TypeMoq.It.isAny())).verifiable(TypeMoq.Times.exactly(2));
                const environments = yield pipEnvService.getInterpreters(resource);
                chai_1.expect(environments).to.be.deep.equal([]);
                appShell.verifyAll();
                logger.verifyAll();
            }));
            test(`Should return interpreter information${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const env = {};
                const pythonPath = 'one';
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: pythonPath }));
                interpreterHelper.setup(v => v.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: 'xyz' }));
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true)).verifiable();
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true)).verifiable();
                const environments = yield pipEnvService.getInterpreters(resource);
                chai_1.expect(environments).to.be.lengthOf(1);
                fileSystem.verifyAll();
            }));
            test(`Should return interpreter information using PipFile defined in Env variable${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const envPipFile = 'XYZ';
                const env = {
                    PIPENV_PIPFILE: envPipFile
                };
                const pythonPath = 'one';
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: pythonPath }));
                interpreterHelper.setup(v => v.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: 'xyz' }));
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.never());
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, envPipFile)))).returns(() => Promise.resolve(true)).verifiable(TypeMoq.Times.once());
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true)).verifiable();
                const environments = yield pipEnvService.getInterpreters(resource);
                chai_1.expect(environments).to.be.lengthOf(1);
                fileSystem.verifyAll();
            }));
        });
    });
});
//# sourceMappingURL=pipEnvService.unit.test.js.map