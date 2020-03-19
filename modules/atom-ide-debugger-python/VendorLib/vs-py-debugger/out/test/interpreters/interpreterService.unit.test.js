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
const chaiAsPromised = require("chai-as-promised");
const events_1 = require("events");
const inversify_1 = require("inversify");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const registry_1 = require("../../client/common/platform/registry");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/process/types");
const types_4 = require("../../client/common/types");
const EnumEx = require("../../client/common/utils/enum");
const misc_1 = require("../../client/common/utils/misc");
const platform_1 = require("../../client/common/utils/platform");
const types_5 = require("../../client/interpreter/configuration/types");
const contracts_1 = require("../../client/interpreter/contracts");
const interpreterService_1 = require("../../client/interpreter/interpreterService");
const types_6 = require("../../client/interpreter/virtualEnvs/types");
const container_1 = require("../../client/ioc/container");
const serviceManager_1 = require("../../client/ioc/serviceManager");
chai_1.use(chaiAsPromised);
const info = {
    architecture: platform_1.Architecture.Unknown,
    companyDisplayName: '',
    displayName: '',
    envName: '',
    path: '',
    type: contracts_1.InterpreterType.Unknown,
    version: '',
    version_info: [0, 0, 0, 'alpha'],
    sysPrefix: '',
    sysVersion: ''
};
suite('Interpreters service', () => {
    let serviceManager;
    let serviceContainer;
    let updater;
    let helper;
    let locator;
    let workspace;
    let config;
    let pipenvLocator;
    let wksLocator;
    let fileSystem;
    let interpreterDisplay;
    let workspacePythonPath;
    let virtualEnvMgr;
    let persistentStateFactory;
    let pythonExecutionFactory;
    let pythonExecutionService;
    function setupSuite() {
        const cont = new inversify_1.Container();
        serviceManager = new serviceManager_1.ServiceManager(cont);
        serviceContainer = new container_1.ServiceContainer(cont);
        updater = TypeMoq.Mock.ofType();
        helper = TypeMoq.Mock.ofType();
        locator = TypeMoq.Mock.ofType();
        workspace = TypeMoq.Mock.ofType();
        config = TypeMoq.Mock.ofType();
        fileSystem = TypeMoq.Mock.ofType();
        interpreterDisplay = TypeMoq.Mock.ofType();
        workspacePythonPath = TypeMoq.Mock.ofType();
        virtualEnvMgr = TypeMoq.Mock.ofType();
        persistentStateFactory = TypeMoq.Mock.ofType();
        pythonExecutionFactory = TypeMoq.Mock.ofType();
        pythonExecutionService = TypeMoq.Mock.ofType();
        pythonExecutionService.setup((p) => p.then).returns(() => undefined);
        workspace.setup(x => x.getConfiguration('python', TypeMoq.It.isAny())).returns(() => config.object);
        pythonExecutionFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(pythonExecutionService.object));
        fileSystem.setup(fs => fs.getFileHash(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        persistentStateFactory
            .setup(p => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => {
            const state = {
                updateValue: () => Promise.resolve()
            };
            return state;
        });
        serviceManager.addSingletonInstance(types_4.IDisposableRegistry, []);
        serviceManager.addSingletonInstance(contracts_1.IInterpreterHelper, helper.object);
        serviceManager.addSingletonInstance(types_5.IPythonPathUpdaterServiceManager, updater.object);
        serviceManager.addSingletonInstance(types_1.IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, locator.object, contracts_1.INTERPRETER_LOCATOR_SERVICE);
        serviceManager.addSingletonInstance(types_2.IFileSystem, fileSystem.object);
        serviceManager.addSingletonInstance(contracts_1.IInterpreterDisplay, interpreterDisplay.object);
        serviceManager.addSingletonInstance(types_6.IVirtualEnvironmentManager, virtualEnvMgr.object);
        serviceManager.addSingletonInstance(types_4.IPersistentStateFactory, persistentStateFactory.object);
        serviceManager.addSingletonInstance(types_3.IPythonExecutionFactory, pythonExecutionFactory.object);
        serviceManager.addSingletonInstance(types_3.IPythonExecutionService, pythonExecutionService.object);
        pipenvLocator = TypeMoq.Mock.ofType();
        wksLocator = TypeMoq.Mock.ofType();
    }
    suite('Misc', () => {
        setup(setupSuite);
        [undefined, vscode_1.Uri.file('xyz')]
            .forEach(resource => {
            const resourceTestSuffix = `(${resource ? 'with' : 'without'} a resource)`;
            test(`Refresh invokes refresh of display ${resourceTestSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                interpreterDisplay
                    .setup(i => i.refresh(TypeMoq.It.isValue(resource)))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());
                const service = new interpreterService_1.InterpreterService(serviceContainer);
                yield service.refresh(resource);
                interpreterDisplay.verifyAll();
            }));
            test(`get Interpreters uses interpreter locactors to get interpreters ${resourceTestSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                locator
                    .setup(l => l.getInterpreters(TypeMoq.It.isValue(resource)))
                    .returns(() => Promise.resolve([]))
                    .verifiable(TypeMoq.Times.once());
                const service = new interpreterService_1.InterpreterService(serviceContainer);
                yield service.getInterpreters(resource);
                locator.verifyAll();
            }));
        });
        test('Changes to active document should invoke intrepreter.refresh method', () => __awaiter(this, void 0, void 0, function* () {
            const service = new interpreterService_1.InterpreterService(serviceContainer);
            const configService = TypeMoq.Mock.ofType();
            const documentManager = TypeMoq.Mock.ofType();
            let activeTextEditorChangeHandler;
            documentManager.setup(d => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
                activeTextEditorChangeHandler = handler;
                return { dispose: misc_1.noop };
            });
            serviceManager.addSingletonInstance(types_4.IConfigurationService, configService.object);
            serviceManager.addSingletonInstance(types_1.IDocumentManager, documentManager.object);
            // tslint:disable-next-line:no-any
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => new events_1.EventEmitter());
            service.initialize();
            const textEditor = TypeMoq.Mock.ofType();
            const uri = vscode_1.Uri.file(path.join('usr', 'file.py'));
            const document = TypeMoq.Mock.ofType();
            textEditor.setup(t => t.document).returns(() => document.object);
            document.setup(d => d.uri).returns(() => uri);
            activeTextEditorChangeHandler(textEditor.object);
            interpreterDisplay.verify(i => i.refresh(TypeMoq.It.isValue(uri)), TypeMoq.Times.once());
        }));
        test('If there is no active document then intrepreter.refresh should not be invoked', () => __awaiter(this, void 0, void 0, function* () {
            const service = new interpreterService_1.InterpreterService(serviceContainer);
            const configService = TypeMoq.Mock.ofType();
            const documentManager = TypeMoq.Mock.ofType();
            let activeTextEditorChangeHandler;
            documentManager.setup(d => d.onDidChangeActiveTextEditor(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
                activeTextEditorChangeHandler = handler;
                return { dispose: misc_1.noop };
            });
            serviceManager.addSingletonInstance(types_4.IConfigurationService, configService.object);
            serviceManager.addSingletonInstance(types_1.IDocumentManager, documentManager.object);
            // tslint:disable-next-line:no-any
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => new events_1.EventEmitter());
            service.initialize();
            activeTextEditorChangeHandler();
            interpreterDisplay.verify(i => i.refresh(TypeMoq.It.isValue(undefined)), TypeMoq.Times.never());
        }));
    });
    suite('Get Interpreter Details', () => {
        setup(setupSuite);
        [undefined, vscode_1.Uri.file('some workspace')]
            .forEach(resource => {
            test(`Ensure undefined is returned if we're unable to retrieve interpreter info (Resource is ${resource})`, () => __awaiter(this, void 0, void 0, function* () {
                const pythonPath = 'SOME VALUE';
                const service = new interpreterService_1.InterpreterService(serviceContainer);
                locator
                    .setup(l => l.getInterpreters(TypeMoq.It.isValue(resource)))
                    .returns(() => Promise.resolve([]))
                    .verifiable(TypeMoq.Times.once());
                helper
                    .setup(h => h.getInterpreterInformation(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());
                virtualEnvMgr
                    .setup(v => v.getEnvironmentName(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(''))
                    .verifiable(TypeMoq.Times.once());
                virtualEnvMgr
                    .setup(v => v.getEnvironmentType(TypeMoq.It.isValue(pythonPath)))
                    .returns(() => Promise.resolve(contracts_1.InterpreterType.Unknown))
                    .verifiable(TypeMoq.Times.once());
                pythonExecutionService
                    .setup(p => p.getExecutablePath())
                    .returns(() => Promise.resolve(pythonPath))
                    .verifiable(TypeMoq.Times.once());
                const details = yield service.getInterpreterDetails(pythonPath, resource);
                locator.verifyAll();
                pythonExecutionService.verifyAll();
                helper.verifyAll();
                chai_1.expect(details).to.be.equal(undefined, 'Not undefined');
            }));
        });
    });
    suite('Should Auto Set Interpreter', () => {
        setup(setupSuite);
        test('Should not auto set interpreter if there is no workspace', () => __awaiter(this, void 0, void 0, function* () {
            const service = new interpreterService_1.InterpreterService(serviceContainer);
            helper
                .setup(h => h.getActiveWorkspaceUri())
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            yield chai_1.expect(service.shouldAutoSetInterpreter()).to.eventually.equal(false, 'not false');
            helper.verifyAll();
        }));
        test('Should not auto set interpreter if there is a value in global user settings (global value is not \'python\')', () => __awaiter(this, void 0, void 0, function* () {
            const service = new interpreterService_1.InterpreterService(serviceContainer);
            workspacePythonPath
                .setup(w => w.folderUri)
                .returns(() => vscode_1.Uri.file('w'))
                .verifiable(TypeMoq.Times.once());
            helper
                .setup(h => h.getActiveWorkspaceUri())
                .returns(() => workspacePythonPath.object)
                .verifiable(TypeMoq.Times.once());
            const pythonPathConfigValue = TypeMoq.Mock.ofType();
            config
                .setup(w => w.inspect(TypeMoq.It.isAny()))
                .returns(() => pythonPathConfigValue.object)
                .verifiable(TypeMoq.Times.once());
            pythonPathConfigValue
                .setup(p => p.globalValue)
                .returns(() => path.join('a', 'bin', 'python'))
                .verifiable(TypeMoq.Times.atLeastOnce());
            yield chai_1.expect(service.shouldAutoSetInterpreter()).to.eventually.equal(false, 'not false');
            helper.verifyAll();
            workspace.verifyAll();
            config.verifyAll();
            pythonPathConfigValue.verifyAll();
        }));
        test('Should not auto set interpreter if there is a value in workspace settings (& value is not \'python\')', () => __awaiter(this, void 0, void 0, function* () {
            const service = new interpreterService_1.InterpreterService(serviceContainer);
            workspacePythonPath
                .setup(w => w.configTarget)
                .returns(() => vscode_1.ConfigurationTarget.Workspace)
                .verifiable(TypeMoq.Times.once());
            helper
                .setup(h => h.getActiveWorkspaceUri())
                .returns(() => workspacePythonPath.object)
                .verifiable(TypeMoq.Times.once());
            const pythonPathConfigValue = TypeMoq.Mock.ofType();
            config
                .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                .returns(() => pythonPathConfigValue.object)
                .verifiable(TypeMoq.Times.once());
            pythonPathConfigValue
                .setup(p => p.globalValue)
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.atLeastOnce());
            pythonPathConfigValue
                .setup(p => p.workspaceValue)
                .returns(() => path.join('a', 'bin', 'python'))
                .verifiable(TypeMoq.Times.atLeastOnce());
            yield chai_1.expect(service.shouldAutoSetInterpreter()).to.eventually.equal(false, 'not false');
            helper.verifyAll();
            workspace.verifyAll();
            config.verifyAll();
            pythonPathConfigValue.verifyAll();
        }));
        [
            { configTarget: vscode_1.ConfigurationTarget.Workspace, label: 'Workspace' },
            { configTarget: vscode_1.ConfigurationTarget.WorkspaceFolder, label: 'Workspace Folder' }
        ].forEach(item => {
            const testSuffix = `(${item.label})`;
            const cfgTarget = item.configTarget;
            test(`Should auto set interpreter if there is no value in workspace settings ${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const service = new interpreterService_1.InterpreterService(serviceContainer);
                workspacePythonPath
                    .setup(w => w.configTarget)
                    .returns(() => cfgTarget)
                    .verifiable(TypeMoq.Times.once());
                helper
                    .setup(h => h.getActiveWorkspaceUri())
                    .returns(() => workspacePythonPath.object)
                    .verifiable(TypeMoq.Times.once());
                const pythonPathConfigValue = TypeMoq.Mock.ofType();
                config
                    .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                    .returns(() => pythonPathConfigValue.object)
                    .verifiable(TypeMoq.Times.once());
                pythonPathConfigValue
                    .setup(p => p.globalValue)
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                if (cfgTarget === vscode_1.ConfigurationTarget.Workspace) {
                    pythonPathConfigValue
                        .setup(p => p.workspaceValue)
                        .returns(() => undefined)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                }
                else {
                    pythonPathConfigValue
                        .setup(p => p.workspaceFolderValue)
                        .returns(() => undefined)
                        .verifiable(TypeMoq.Times.atLeastOnce());
                }
                yield chai_1.expect(service.shouldAutoSetInterpreter()).to.eventually.equal(true, 'not true');
                helper.verifyAll();
                workspace.verifyAll();
                config.verifyAll();
                pythonPathConfigValue.verifyAll();
            }));
            test(`Should auto set interpreter if there is no value in workspace settings and value is \'python\' ${testSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
                const service = new interpreterService_1.InterpreterService(serviceContainer);
                workspacePythonPath
                    .setup(w => w.configTarget)
                    .returns(() => vscode_1.ConfigurationTarget.Workspace)
                    .verifiable(TypeMoq.Times.once());
                helper
                    .setup(h => h.getActiveWorkspaceUri())
                    .returns(() => workspacePythonPath.object)
                    .verifiable(TypeMoq.Times.once());
                const pythonPathConfigValue = TypeMoq.Mock.ofType();
                config
                    .setup(w => w.inspect(TypeMoq.It.isValue('pythonPath')))
                    .returns(() => pythonPathConfigValue.object)
                    .verifiable(TypeMoq.Times.once());
                pythonPathConfigValue
                    .setup(p => p.globalValue)
                    .returns(() => undefined)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                pythonPathConfigValue
                    .setup(p => p.workspaceValue)
                    .returns(() => 'python')
                    .verifiable(TypeMoq.Times.atLeastOnce());
                yield chai_1.expect(service.shouldAutoSetInterpreter()).to.eventually.equal(true, 'not true');
                helper.verifyAll();
                workspace.verifyAll();
                config.verifyAll();
                pythonPathConfigValue.verifyAll();
            }));
        });
    });
    suite('Auto Set Interpreter', () => {
        setup(setupSuite);
        test('autoset interpreter - no workspace', () => __awaiter(this, void 0, void 0, function* () {
            yield verifyUpdateCalled(TypeMoq.Times.never());
        }));
        test('autoset interpreter - global pythonPath in config', () => __awaiter(this, void 0, void 0, function* () {
            setupWorkspace('folder');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python', globalValue: 'global' };
            });
            yield verifyUpdateCalled(TypeMoq.Times.never());
        }));
        test('autoset interpreter - workspace has no pythonPath in config', () => __awaiter(this, void 0, void 0, function* () {
            setupWorkspace('folder');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python' };
            });
            const interpreter = Object.assign({}, info, { path: path.join('folder', 'py1', 'bin', 'python.exe'), type: contracts_1.InterpreterType.Unknown });
            setupLocators([interpreter], []);
            yield verifyUpdateCalled(TypeMoq.Times.once());
        }));
        test('autoset interpreter - workspace has default pythonPath in config', () => __awaiter(this, void 0, void 0, function* () {
            setupWorkspace('folder');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python', workspaceValue: 'python' };
            });
            setupLocators([], []);
            yield verifyUpdateCalled(TypeMoq.Times.never());
        }));
        test('autoset interpreter - pipenv workspace', () => __awaiter(this, void 0, void 0, function* () {
            setupWorkspace('folder');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python', workspaceValue: 'python' };
            });
            const interpreter = Object.assign({}, info, { path: 'python', type: contracts_1.InterpreterType.VirtualEnv });
            setupLocators([], [interpreter]);
            yield verifyUpdateCallData('python', vscode_1.ConfigurationTarget.Workspace, 'folder');
        }));
        test('autoset interpreter - workspace without interpreter', () => __awaiter(this, void 0, void 0, function* () {
            setupWorkspace('root');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python', workspaceValue: 'elsewhere' };
            });
            const interpreter = Object.assign({}, info, { path: 'elsewhere', type: contracts_1.InterpreterType.Unknown });
            setupLocators([interpreter], []);
            yield verifyUpdateCalled(TypeMoq.Times.never());
        }));
        test('autoset interpreter - workspace with interpreter', () => __awaiter(this, void 0, void 0, function* () {
            setupWorkspace('root');
            config.setup(x => x.inspect('pythonPath')).returns(() => {
                return { key: 'python' };
            });
            const intPath = path.join('root', 'under', 'bin', 'python.exe');
            const interpreter = Object.assign({}, info, { path: intPath, type: contracts_1.InterpreterType.Unknown });
            setupLocators([interpreter], []);
            yield verifyUpdateCallData(intPath, vscode_1.ConfigurationTarget.Workspace, 'root');
        }));
        function verifyUpdateCalled(times) {
            return __awaiter(this, void 0, void 0, function* () {
                const service = new interpreterService_1.InterpreterService(serviceContainer);
                yield service.autoSetInterpreter();
                updater
                    .verify(x => x.updatePythonPath(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), times);
            });
        }
        function verifyUpdateCallData(pythonPath, target, wksFolder) {
            return __awaiter(this, void 0, void 0, function* () {
                let pp;
                let confTarget;
                let trigger;
                let wks;
                updater
                    .setup(x => x.updatePythonPath(TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                    // tslint:disable-next-line:no-any
                    .callback((p, c, t, w) => {
                    pp = p;
                    confTarget = c;
                    trigger = t;
                    wks = w;
                })
                    .returns(() => Promise.resolve());
                const service = new interpreterService_1.InterpreterService(serviceContainer);
                yield service.autoSetInterpreter();
                chai_1.expect(pp).not.to.be.equal(undefined, 'updatePythonPath not called');
                chai_1.expect(pp).to.be.equal(pythonPath, 'invalid Python path');
                chai_1.expect(confTarget).to.be.equal(target, 'invalid configuration target');
                chai_1.expect(trigger).to.be.equal('load', 'invalid trigger');
                chai_1.expect(wks.fsPath).to.be.equal(vscode_1.Uri.file(wksFolder).fsPath, 'invalid workspace Uri');
            });
        }
        function setupWorkspace(folder) {
            const wsPath = {
                folderUri: vscode_1.Uri.file(folder),
                configTarget: vscode_1.ConfigurationTarget.Workspace
            };
            helper.setup(x => x.getActiveWorkspaceUri()).returns(() => wsPath);
        }
        function setupLocators(wks, pipenv) {
            pipenvLocator.setup(x => x.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(pipenv));
            serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, pipenvLocator.object, contracts_1.PIPENV_SERVICE);
            wksLocator.setup(x => x.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(wks));
            serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, wksLocator.object, contracts_1.WORKSPACE_VIRTUAL_ENV_SERVICE);
        }
    });
    // This is kind of a verbose test, but we need to ensure we have covered all permutations.
    // Also we have special handling for certain types of interpreters.
    suite('Display Format (with all permutations)', () => {
        setup(setupSuite);
        [undefined, vscode_1.Uri.file('xyz')].forEach(resource => {
            [undefined, [1, 2, 3, 'alpha']].forEach(versionInfo => {
                // Forced cast to ignore TS warnings.
                EnumEx.getNamesAndValues(platform_1.Architecture).concat(undefined).forEach(arch => {
                    [undefined, path.join('a', 'b', 'c', 'd', 'bin', 'python')].forEach(pythonPath => {
                        // Forced cast to ignore TS warnings.
                        EnumEx.getNamesAndValues(contracts_1.InterpreterType).concat(undefined).forEach(interpreterType => {
                            [undefined, 'my env name'].forEach(envName => {
                                ['', 'my pipenv name'].forEach(pipEnvName => {
                                    const testName = [`${resource ? 'With' : 'Without'} a workspace`,
                                        `${versionInfo ? 'with' : 'without'} version information`,
                                        `${arch ? arch.name : 'without'} architecture`,
                                        `${pythonPath ? 'with' : 'without'} python Path`,
                                        `${interpreterType ? `${interpreterType.name} interpreter type` : 'without interpreter type'}`,
                                        `${envName ? 'with' : 'without'} environment name`,
                                        `${pipEnvName ? 'with' : 'without'} pip environment`
                                    ].join(', ');
                                    test(testName, () => __awaiter(this, void 0, void 0, function* () {
                                        const interpreterInfo = {
                                            version_info: versionInfo,
                                            architecture: arch ? arch.value : undefined,
                                            envName,
                                            type: interpreterType ? interpreterType.value : undefined,
                                            path: pythonPath
                                        };
                                        if (interpreterInfo.path && interpreterType && interpreterType.value === contracts_1.InterpreterType.PipEnv) {
                                            virtualEnvMgr
                                                .setup(v => v.getEnvironmentName(TypeMoq.It.isValue(interpreterInfo.path), TypeMoq.It.isAny()))
                                                .returns(() => Promise.resolve(pipEnvName));
                                        }
                                        if (interpreterType) {
                                            helper
                                                .setup(h => h.getInterpreterTypeDisplayName(TypeMoq.It.isValue(interpreterType.value)))
                                                .returns(() => `${interpreterType.name}_display`);
                                        }
                                        const service = new interpreterService_1.InterpreterService(serviceContainer);
                                        const expectedDisplayName = buildDisplayName(interpreterInfo);
                                        const displayName = yield service.getDisplayName(interpreterInfo, resource);
                                        chai_1.expect(displayName).to.equal(expectedDisplayName);
                                    }));
                                    function buildDisplayName(interpreterInfo) {
                                        const displayNameParts = ['Python'];
                                        const envSuffixParts = [];
                                        if (interpreterInfo.version_info && interpreterInfo.version_info.length > 0) {
                                            displayNameParts.push(interpreterInfo.version_info.slice(0, 3).join('.'));
                                        }
                                        if (interpreterInfo.architecture) {
                                            displayNameParts.push(registry_1.getArchitectureDisplayName(interpreterInfo.architecture));
                                        }
                                        if (!interpreterInfo.envName && interpreterInfo.path && interpreterInfo.type && interpreterInfo.type === contracts_1.InterpreterType.PipEnv && pipEnvName) {
                                            // If we do not have the name of the environment, then try to get it again.
                                            // This can happen based on the context (i.e. resource).
                                            // I.e. we can determine if an environment is PipEnv only when giving it the right workspacec path (i.e. resource).
                                            interpreterInfo.envName = pipEnvName;
                                        }
                                        if (interpreterInfo.envName && interpreterInfo.envName.length > 0) {
                                            envSuffixParts.push(`'${interpreterInfo.envName}'`);
                                        }
                                        if (interpreterInfo.type) {
                                            envSuffixParts.push(`${interpreterType.name}_display`);
                                        }
                                        const envSuffix = envSuffixParts.length === 0 ? '' :
                                            `(${envSuffixParts.join(': ')})`;
                                        return `${displayNameParts.join(' ')} ${envSuffix}`.trim();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
//# sourceMappingURL=interpreterService.unit.test.js.map