"use strict";
// tslint:disable:max-func-body-length
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
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const configSettings_1 = require("../../client/common/configSettings");
const service_1 = require("../../client/common/configuration/service");
const condaInstaller_1 = require("../../client/common/installer/condaInstaller");
const pipEnvInstaller_1 = require("../../client/common/installer/pipEnvInstaller");
const pipInstaller_1 = require("../../client/common/installer/pipInstaller");
const productInstaller_1 = require("../../client/common/installer/productInstaller");
const types_2 = require("../../client/common/installer/types");
const logger_1 = require("../../client/common/logger");
const persistentState_1 = require("../../client/common/persistentState");
const fileSystem_1 = require("../../client/common/platform/fileSystem");
const pathUtils_1 = require("../../client/common/platform/pathUtils");
const platformService_1 = require("../../client/common/platform/platformService");
const types_3 = require("../../client/common/platform/types");
const currentProcess_1 = require("../../client/common/process/currentProcess");
const types_4 = require("../../client/common/process/types");
const types_5 = require("../../client/common/terminal/types");
const types_6 = require("../../client/common/types");
const platform_1 = require("../../client/common/utils/platform");
const contracts_1 = require("../../client/interpreter/contracts");
const common_1 = require("../common");
const moduleInstaller_1 = require("../mocks/moduleInstaller");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const initialize_1 = require("./../initialize");
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
suite('Module Installer', () => {
    [undefined, vscode_1.Uri.file(__filename)].forEach(resource => {
        let ioc;
        let mockTerminalService;
        let condaService;
        let interpreterService;
        let mockTerminalFactory;
        const workspaceUri = vscode_1.Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
        suiteSetup(initialize_1.initializeTest);
        setup(() => __awaiter(this, void 0, void 0, function* () {
            initializeDI();
            yield initialize_1.initializeTest();
            yield resetSettings();
        }));
        suiteTeardown(() => __awaiter(this, void 0, void 0, function* () {
            yield initialize_1.closeActiveWindows();
            yield resetSettings();
        }));
        teardown(() => __awaiter(this, void 0, void 0, function* () {
            ioc.dispose();
            yield initialize_1.closeActiveWindows();
        }));
        function initializeDI() {
            ioc = new serviceRegistry_1.UnitTestIocContainer();
            ioc.registerUnitTestTypes();
            ioc.registerVariableTypes();
            ioc.registerLinterTypes();
            ioc.registerFormatterTypes();
            ioc.serviceManager.addSingleton(types_6.IPersistentStateFactory, persistentState_1.PersistentStateFactory);
            ioc.serviceManager.addSingleton(types_6.ILogger, logger_1.Logger);
            ioc.serviceManager.addSingleton(types_6.IInstaller, productInstaller_1.ProductInstaller);
            mockTerminalService = TypeMoq.Mock.ofType();
            mockTerminalFactory = TypeMoq.Mock.ofType();
            mockTerminalFactory.setup(t => t.getTerminalService(TypeMoq.It.isValue(resource)))
                .returns(() => mockTerminalService.object)
                .verifiable(TypeMoq.Times.atLeastOnce());
            // If resource is provided, then ensure we do not invoke without the resource.
            mockTerminalFactory.setup(t => t.getTerminalService(TypeMoq.It.isAny()))
                .callback(passedInResource => chai_1.expect(passedInResource).to.be.equal(resource))
                .returns(() => mockTerminalService.object);
            ioc.serviceManager.addSingletonInstance(types_5.ITerminalServiceFactory, mockTerminalFactory.object);
            ioc.serviceManager.addSingleton(types_2.IModuleInstaller, pipInstaller_1.PipInstaller);
            ioc.serviceManager.addSingleton(types_2.IModuleInstaller, condaInstaller_1.CondaInstaller);
            ioc.serviceManager.addSingleton(types_2.IModuleInstaller, pipEnvInstaller_1.PipEnvInstaller);
            condaService = TypeMoq.Mock.ofType();
            ioc.serviceManager.addSingletonInstance(contracts_1.ICondaService, condaService.object);
            interpreterService = TypeMoq.Mock.ofType();
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterService, interpreterService.object);
            ioc.serviceManager.addSingleton(types_6.IPathUtils, pathUtils_1.PathUtils);
            ioc.serviceManager.addSingleton(types_6.ICurrentProcess, currentProcess_1.CurrentProcess);
            ioc.serviceManager.addSingleton(types_3.IFileSystem, fileSystem_1.FileSystem);
            ioc.serviceManager.addSingleton(types_3.IPlatformService, platformService_1.PlatformService);
            ioc.serviceManager.addSingleton(types_6.IConfigurationService, service_1.ConfigurationService);
            const workspaceService = TypeMoq.Mock.ofType();
            ioc.serviceManager.addSingletonInstance(types_1.IWorkspaceService, workspaceService.object);
            const http = TypeMoq.Mock.ofType();
            http.setup(h => h.get(TypeMoq.It.isValue('proxy'), TypeMoq.It.isAny())).returns(() => '');
            workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('http'))).returns(() => http.object);
            ioc.registerMockProcessTypes();
            ioc.serviceManager.addSingletonInstance(types_6.IsWindows, false);
        }
        function resetSettings() {
            return __awaiter(this, void 0, void 0, function* () {
                const configService = ioc.serviceManager.get(types_6.IConfigurationService);
                yield configService.updateSetting('linting.pylintEnabled', true, common_1.rootWorkspaceUri, vscode_1.ConfigurationTarget.Workspace);
            });
        }
        function getCurrentPythonPath() {
            return __awaiter(this, void 0, void 0, function* () {
                const pythonPath = configSettings_1.PythonSettings.getInstance(workspaceUri).pythonPath;
                if (path.basename(pythonPath) === pythonPath) {
                    const pythonProc = yield ioc.serviceContainer.get(types_4.IPythonExecutionFactory).create({ resource: workspaceUri });
                    return pythonProc.getExecutablePath().catch(() => pythonPath);
                }
                else {
                    return pythonPath;
                }
            });
        }
        test('Ensure pip is supported and conda is not', () => __awaiter(this, void 0, void 0, function* () {
            ioc.serviceManager.addSingletonInstance(types_2.IModuleInstaller, new moduleInstaller_1.MockModuleInstaller('mock', true));
            const mockInterpreterLocator = TypeMoq.Mock.ofType();
            mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, mockInterpreterLocator.object, contracts_1.INTERPRETER_LOCATOR_SERVICE);
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, TypeMoq.Mock.ofType().object, contracts_1.PIPENV_SERVICE);
            const processService = yield ioc.serviceContainer.get(types_4.IProcessServiceFactory).create();
            processService.onExec((file, args, options, callback) => {
                if (args.length > 1 && args[0] === '-c' && args[1] === 'import pip') {
                    callback({ stdout: '' });
                }
                if (args.length > 0 && args[0] === '--version' && file === 'conda') {
                    callback({ stdout: '', stderr: 'not available' });
                }
            });
            const moduleInstallers = ioc.serviceContainer.getAll(types_2.IModuleInstaller);
            chai_1.expect(moduleInstallers).length(4, 'Incorrect number of installers');
            const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip');
            chai_1.expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');
            yield chai_1.expect(pipInstaller.isSupported()).to.eventually.equal(true, 'Pip is not supported');
            const condaInstaller = moduleInstallers.find(item => item.displayName === 'Conda');
            chai_1.expect(condaInstaller).not.to.be.an('undefined', 'Conda installer not found');
            yield chai_1.expect(condaInstaller.isSupported()).to.eventually.equal(false, 'Conda is supported');
            const mockInstaller = moduleInstallers.find(item => item.displayName === 'mock');
            chai_1.expect(mockInstaller).not.to.be.an('undefined', 'mock installer not found');
            yield chai_1.expect(mockInstaller.isSupported()).to.eventually.equal(true, 'mock is not supported');
        }));
        test('Ensure pip is supported', () => __awaiter(this, void 0, void 0, function* () {
            ioc.serviceManager.addSingletonInstance(types_2.IModuleInstaller, new moduleInstaller_1.MockModuleInstaller('mock', true));
            const pythonPath = yield getCurrentPythonPath();
            const mockInterpreterLocator = TypeMoq.Mock.ofType();
            mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([Object.assign({}, info, { architecture: platform_1.Architecture.Unknown, companyDisplayName: '', displayName: '', envName: '', path: pythonPath, type: contracts_1.InterpreterType.Conda, version: '' })]));
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, mockInterpreterLocator.object, contracts_1.INTERPRETER_LOCATOR_SERVICE);
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, TypeMoq.Mock.ofType().object, contracts_1.PIPENV_SERVICE);
            const processService = yield ioc.serviceContainer.get(types_4.IProcessServiceFactory).create();
            processService.onExec((file, args, options, callback) => {
                if (args.length > 1 && args[0] === '-c' && args[1] === 'import pip') {
                    callback({ stdout: '' });
                }
                if (args.length > 0 && args[0] === '--version' && file === 'conda') {
                    callback({ stdout: '' });
                }
            });
            const moduleInstallers = ioc.serviceContainer.getAll(types_2.IModuleInstaller);
            chai_1.expect(moduleInstallers).length(4, 'Incorrect number of installers');
            const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip');
            chai_1.expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');
            yield chai_1.expect(pipInstaller.isSupported()).to.eventually.equal(true, 'Pip is not supported');
        }));
        test('Ensure conda is supported', () => __awaiter(this, void 0, void 0, function* () {
            const serviceContainer = TypeMoq.Mock.ofType();
            const configService = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_6.IConfigurationService))).returns(() => configService.object);
            const settings = TypeMoq.Mock.ofType();
            const pythonPath = 'pythonABC';
            settings.setup(s => s.pythonPath).returns(() => pythonPath);
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.ICondaService))).returns(() => condaService.object);
            condaService.setup(c => c.isCondaAvailable()).returns(() => Promise.resolve(true));
            condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            const condaInstaller = new condaInstaller_1.CondaInstaller(serviceContainer.object);
            yield chai_1.expect(condaInstaller.isSupported()).to.eventually.equal(true, 'Conda is not supported');
        }));
        test('Ensure conda is not supported even if conda is available', () => __awaiter(this, void 0, void 0, function* () {
            const serviceContainer = TypeMoq.Mock.ofType();
            const configService = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_6.IConfigurationService))).returns(() => configService.object);
            const settings = TypeMoq.Mock.ofType();
            const pythonPath = 'pythonABC';
            settings.setup(s => s.pythonPath).returns(() => pythonPath);
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.ICondaService))).returns(() => condaService.object);
            condaService.setup(c => c.isCondaAvailable()).returns(() => Promise.resolve(true));
            condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(false));
            const condaInstaller = new condaInstaller_1.CondaInstaller(serviceContainer.object);
            yield chai_1.expect(condaInstaller.isSupported()).to.eventually.equal(false, 'Conda should not be supported');
        }));
        const resourceTestNameSuffix = resource ? ' with a resource' : ' without a resource';
        test(`Validate pip install arguments ${resourceTestNameSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            const interpreterPath = yield getCurrentPythonPath();
            const mockInterpreterLocator = TypeMoq.Mock.ofType();
            mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([Object.assign({}, info, { path: interpreterPath, type: contracts_1.InterpreterType.Unknown })]));
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, mockInterpreterLocator.object, contracts_1.INTERPRETER_LOCATOR_SERVICE);
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, TypeMoq.Mock.ofType().object, contracts_1.PIPENV_SERVICE);
            const interpreter = Object.assign({}, info, { type: contracts_1.InterpreterType.Unknown, path: common_1.PYTHON_PATH });
            interpreterService.setup(x => x.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve(interpreter));
            const moduleName = 'xyz';
            const moduleInstallers = ioc.serviceContainer.getAll(types_2.IModuleInstaller);
            const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip');
            chai_1.expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');
            let argsSent = [];
            mockTerminalService
                .setup(t => t.sendCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
                .returns((cmd, args) => { argsSent = args; return Promise.resolve(void 0); });
            // tslint:disable-next-line:no-any
            interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve({ type: contracts_1.InterpreterType.Unknown }));
            yield pipInstaller.installModule(moduleName, resource);
            mockTerminalFactory.verifyAll();
            chai_1.expect(argsSent.join(' ')).equal(`-m pip install -U ${moduleName} --user`, 'Invalid command sent to terminal for installation.');
        }));
        test(`Validate Conda install arguments ${resourceTestNameSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            const interpreterPath = yield getCurrentPythonPath();
            const mockInterpreterLocator = TypeMoq.Mock.ofType();
            mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([Object.assign({}, info, { path: interpreterPath, type: contracts_1.InterpreterType.Conda })]));
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, mockInterpreterLocator.object, contracts_1.INTERPRETER_LOCATOR_SERVICE);
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, TypeMoq.Mock.ofType().object, contracts_1.PIPENV_SERVICE);
            const moduleName = 'xyz';
            const moduleInstallers = ioc.serviceContainer.getAll(types_2.IModuleInstaller);
            const pipInstaller = moduleInstallers.find(item => item.displayName === 'Pip');
            chai_1.expect(pipInstaller).not.to.be.an('undefined', 'Pip installer not found');
            let argsSent = [];
            mockTerminalService
                .setup(t => t.sendCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
                .returns((cmd, args) => { argsSent = args; return Promise.resolve(void 0); });
            yield pipInstaller.installModule(moduleName, resource);
            mockTerminalFactory.verifyAll();
            chai_1.expect(argsSent.join(' ')).equal(`-m pip install -U ${moduleName}`, 'Invalid command sent to terminal for installation.');
        }));
        test(`Validate pipenv install arguments ${resourceTestNameSuffix}`, () => __awaiter(this, void 0, void 0, function* () {
            const mockInterpreterLocator = TypeMoq.Mock.ofType();
            mockInterpreterLocator.setup(p => p.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve([Object.assign({}, info, { path: 'interpreterPath', type: contracts_1.InterpreterType.VirtualEnv })]));
            ioc.serviceManager.addSingletonInstance(contracts_1.IInterpreterLocatorService, mockInterpreterLocator.object, contracts_1.PIPENV_SERVICE);
            const moduleName = 'xyz';
            const moduleInstallers = ioc.serviceContainer.getAll(types_2.IModuleInstaller);
            const pipInstaller = moduleInstallers.find(item => item.displayName === 'pipenv');
            chai_1.expect(pipInstaller).not.to.be.an('undefined', 'pipenv installer not found');
            let argsSent = [];
            let command;
            mockTerminalService
                .setup(t => t.sendCommand(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
                .returns((cmd, args) => {
                argsSent = args;
                command = cmd;
                return Promise.resolve(void 0);
            });
            yield pipInstaller.installModule(moduleName, resource);
            mockTerminalFactory.verifyAll();
            chai_1.expect(command).equal('pipenv', 'Invalid command sent to terminal for installation.');
            chai_1.expect(argsSent.join(' ')).equal(`install ${moduleName} --dev`, 'Invalid command arguments sent to terminal for installation.');
        }));
    });
});
//# sourceMappingURL=moduleInstaller.test.js.map