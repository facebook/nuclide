"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-require-imports no-var-requires no-any max-func-body-length
const assert = require("assert");
const chai_1 = require("chai");
const os_1 = require("os");
const path = require("path");
const semver_1 = require("semver");
const TypeMoq = require("typemoq");
const fileSystem_1 = require("../../client/common/platform/fileSystem");
const types_1 = require("../../client/common/platform/types");
const types_2 = require("../../client/common/process/types");
const types_3 = require("../../client/common/types");
const platform_1 = require("../../client/common/utils/platform");
const contracts_1 = require("../../client/interpreter/contracts");
const condaService_1 = require("../../client/interpreter/locators/services/condaService");
const mocks_1 = require("./mocks");
const untildify = require('untildify');
const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
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
suite('Interpreters Conda Service', () => {
    let processService;
    let platformService;
    let condaService;
    let fileSystem;
    let config;
    let settings;
    let registryInterpreterLocatorService;
    let serviceContainer;
    let procServiceFactory;
    let logger;
    let condaPathSetting;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        condaPathSetting = '';
        logger = TypeMoq.Mock.ofType();
        processService = TypeMoq.Mock.ofType();
        platformService = TypeMoq.Mock.ofType();
        registryInterpreterLocatorService = TypeMoq.Mock.ofType();
        fileSystem = TypeMoq.Mock.ofType();
        config = TypeMoq.Mock.ofType();
        settings = TypeMoq.Mock.ofType();
        procServiceFactory = TypeMoq.Mock.ofType();
        processService.setup((x) => x.then).returns(() => undefined);
        procServiceFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
        serviceContainer = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IProcessServiceFactory), TypeMoq.It.isAny())).returns(() => procServiceFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IPlatformService), TypeMoq.It.isAny())).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.ILogger), TypeMoq.It.isAny())).returns(() => logger.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IFileSystem), TypeMoq.It.isAny())).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService), TypeMoq.It.isAny())).returns(() => config.object);
        config.setup(c => c.getSettings(TypeMoq.It.isValue(undefined))).returns(() => settings.object);
        settings.setup(p => p.condaPath).returns(() => condaPathSetting);
        condaService = new condaService_1.CondaService(serviceContainer.object, registryInterpreterLocatorService.object);
        fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p1, p2) => {
            return new fileSystem_1.FileSystem(platformService.object).arePathsSame(p1, p2);
        });
    }));
    function identifyPythonPathAsCondaEnvironment(isWindows, isOsx, isLinux, pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            platformService.setup(p => p.isLinux).returns(() => isLinux);
            platformService.setup(p => p.isWindows).returns(() => isWindows);
            platformService.setup(p => p.isMac).returns(() => isOsx);
            const isCondaEnv = yield condaService.isCondaEnvironment(pythonPath);
            chai_1.expect(isCondaEnv).to.be.equal(true, 'Path not identified as a conda path');
        });
    }
    test('Correctly identifies a python path as a conda environment (windows)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        yield identifyPythonPathAsCondaEnvironment(true, false, false, pythonPath);
    }));
    test('Correctly identifies a python path as a conda environment (linux)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        yield identifyPythonPathAsCondaEnvironment(false, false, true, pythonPath);
    }));
    test('Correctly identifies a python path as a conda environment (osx)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        yield identifyPythonPathAsCondaEnvironment(false, true, false, pythonPath);
    }));
    function identifyPythonPathAsNonCondaEnvironment(isWindows, isOsx, isLinux, pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            platformService.setup(p => p.isLinux).returns(() => isLinux);
            platformService.setup(p => p.isWindows).returns(() => isWindows);
            platformService.setup(p => p.isMac).returns(() => isOsx);
            fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(false));
            fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(false));
            const isCondaEnv = yield condaService.isCondaEnvironment(pythonPath);
            chai_1.expect(isCondaEnv).to.be.equal(false, 'Path incorrectly identified as a conda path');
        });
    }
    test('Correctly identifies a python path as a non-conda environment (windows)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'enva', 'python.exe');
        yield identifyPythonPathAsNonCondaEnvironment(true, false, false, pythonPath);
    }));
    test('Correctly identifies a python path as a non-conda environment (linux)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        yield identifyPythonPathAsNonCondaEnvironment(false, false, true, pythonPath);
    }));
    test('Correctly identifies a python path as a non-conda environment (osx)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('users', 'xyz', '.conda', 'envs', 'enva', 'bin', 'python');
        yield identifyPythonPathAsNonCondaEnvironment(false, true, false, pythonPath);
    }));
    function checkCondaNameAndPathForCondaEnvironments(isWindows, isOsx, isLinux, pythonPath, condaEnvsPath, expectedCondaEnv) {
        return __awaiter(this, void 0, void 0, function* () {
            const condaEnvironments = [
                { name: 'One', path: path.join(condaEnvsPath, 'one') },
                { name: 'Three', path: path.join(condaEnvsPath, 'three') },
                { name: 'Seven', path: path.join(condaEnvsPath, 'seven') },
                { name: 'Eight', path: path.join(condaEnvsPath, 'Eight 8') },
                { name: 'nine 9', path: path.join(condaEnvsPath, 'nine 9') }
            ];
            platformService.setup(p => p.isLinux).returns(() => isLinux);
            platformService.setup(p => p.isWindows).returns(() => isWindows);
            platformService.setup(p => p.isMac).returns(() => isOsx);
            const stateFactory = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPersistentStateFactory))).returns(() => stateFactory.object);
            const state = new mocks_1.MockState({ data: condaEnvironments });
            stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isValue('CONDA_ENVIRONMENTS'), TypeMoq.It.isValue(undefined))).returns(() => state);
            const condaEnv = yield condaService.getCondaEnvironment(pythonPath);
            chai_1.expect(condaEnv).deep.equal(expectedCondaEnv, 'Conda environment not identified');
        });
    }
    test('Correctly retrieves conda environment (windows)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'python.exe');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        yield checkCondaNameAndPathForCondaEnvironments(true, false, false, pythonPath, condaEnvDir, { name: 'One', path: path.dirname(pythonPath) });
    }));
    test('Correctly retrieves conda environment with spaces in env name (windows)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'eight 8', 'python.exe');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        yield checkCondaNameAndPathForCondaEnvironments(true, false, false, pythonPath, condaEnvDir, { name: 'Eight', path: path.dirname(pythonPath) });
    }));
    test('Correctly retrieves conda environment (osx)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'bin', 'python');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        yield checkCondaNameAndPathForCondaEnvironments(false, true, false, pythonPath, condaEnvDir, { name: 'One', path: path.join(path.dirname(pythonPath), '..') });
    }));
    test('Correctly retrieves conda environment with spaces in env name (osx)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'Eight 8', 'bin', 'python');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        yield checkCondaNameAndPathForCondaEnvironments(false, true, false, pythonPath, condaEnvDir, { name: 'Eight', path: path.join(path.dirname(pythonPath), '..') });
    }));
    test('Correctly retrieves conda environment (linux)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'bin', 'python');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        yield checkCondaNameAndPathForCondaEnvironments(false, false, true, pythonPath, condaEnvDir, { name: 'One', path: path.join(path.dirname(pythonPath), '..') });
    }));
    test('Correctly retrieves conda environment with spaces in env name (linux)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'Eight 8', 'bin', 'python');
        const condaEnvDir = path.join('c', 'users', 'xyz', '.conda', 'envs');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), '..', 'conda-meta')))).returns(() => Promise.resolve(true));
        yield checkCondaNameAndPathForCondaEnvironments(false, false, true, pythonPath, condaEnvDir, { name: 'Eight', path: path.join(path.dirname(pythonPath), '..') });
    }));
    test('Ignore cache if environment is not found in the cache (conda env is detected second time round)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'newEnvironment', 'python.exe');
        const condaEnvsPath = path.join('c', 'users', 'xyz', '.conda', 'envs');
        const condaEnvironments = [
            { name: 'One', path: path.join(condaEnvsPath, 'one') },
            { name: 'Three', path: path.join(condaEnvsPath, 'three') },
            { name: 'Seven', path: path.join(condaEnvsPath, 'seven') },
            { name: 'Eight', path: path.join(condaEnvsPath, 'Eight 8') },
            { name: 'nine 9', path: path.join(condaEnvsPath, 'nine 9') }
        ];
        platformService.setup(p => p.isLinux).returns(() => false);
        platformService.setup(p => p.isWindows).returns(() => true);
        platformService.setup(p => p.isMac).returns(() => false);
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        const stateFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new mocks_1.MockState({ data: condaEnvironments });
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isValue('CONDA_ENVIRONMENTS'), TypeMoq.It.isValue(undefined))).returns(() => state);
        const envList = ['# conda environments:',
            '#',
            'base                  *  /Users/donjayamanne/anaconda3',
            'one                      /Users/donjayamanne/anaconda3/envs/one',
            'one two                  /Users/donjayamanne/anaconda3/envs/one two',
            'py27                     /Users/donjayamanne/anaconda3/envs/py27',
            'py36                     /Users/donjayamanne/anaconda3/envs/py36',
            'three                    /Users/donjayamanne/anaconda3/envs/three',
            `newEnvironment           ${path.join(condaEnvsPath, 'newEnvironment')}`
        ];
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: envList.join(os_1.EOL) }));
        const condaEnv = yield condaService.getCondaEnvironment(pythonPath);
        chai_1.expect(condaEnv).deep.equal({ name: 'newEnvironment', path: path.dirname(pythonPath) }, 'Conda environment not identified after ignoring cache');
        chai_1.expect(state.data.data).lengthOf(7, 'Incorrect number of items in the cache');
    }));
    test('Ignore cache if environment is not found in the cache (cond env is not detected in conda env list)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'newEnvironment', 'python.exe');
        const condaEnvsPath = path.join('c', 'users', 'xyz', '.conda', 'envs');
        const condaEnvironments = [
            { name: 'One', path: path.join(condaEnvsPath, 'one') },
            { name: 'Three', path: path.join(condaEnvsPath, 'three') },
            { name: 'Seven', path: path.join(condaEnvsPath, 'seven') },
            { name: 'Eight', path: path.join(condaEnvsPath, 'Eight 8') },
            { name: 'nine 9', path: path.join(condaEnvsPath, 'nine 9') }
        ];
        platformService.setup(p => p.isLinux).returns(() => false);
        platformService.setup(p => p.isWindows).returns(() => true);
        platformService.setup(p => p.isMac).returns(() => false);
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        const stateFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new mocks_1.MockState({ data: condaEnvironments });
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isValue('CONDA_ENVIRONMENTS'), TypeMoq.It.isValue(undefined))).returns(() => state);
        const envList = ['# conda environments:',
            '#',
            'base                  *  /Users/donjayamanne/anaconda3',
            'one                      /Users/donjayamanne/anaconda3/envs/one',
            'one two                  /Users/donjayamanne/anaconda3/envs/one two',
            'py27                     /Users/donjayamanne/anaconda3/envs/py27',
            'py36                     /Users/donjayamanne/anaconda3/envs/py36',
            'three                    /Users/donjayamanne/anaconda3/envs/three'
        ];
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: envList.join(os_1.EOL) }));
        const condaEnv = yield condaService.getCondaEnvironment(pythonPath);
        chai_1.expect(condaEnv).deep.equal(undefined, 'Conda environment incorrectly identified after ignoring cache');
        chai_1.expect(state.data.data).lengthOf(6, 'Incorrect number of items in the cache');
    }));
    test('Must use Conda env from Registry to locate conda.exe', () => __awaiter(this, void 0, void 0, function* () {
        const condaPythonExePath = path.join('dumyPath', 'environments', 'conda', 'Scripts', 'python.exe');
        const registryInterpreters = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Anaconda', path: condaPythonExePath, companyDisplayName: 'Two 2', version: '1.11.0', type: contracts_1.InterpreterType.Conda },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.', type: contracts_1.InterpreterType.Unknown }
        ].map(item => {
            return Object.assign({}, info, item);
        });
        const condaInterpreterIndex = registryInterpreters.findIndex(i => i.displayName === 'Anaconda');
        const expectedCodnaPath = path.join(path.dirname(registryInterpreters[condaInterpreterIndex].path), 'conda.exe');
        platformService.setup(p => p.isWindows).returns(() => true);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService.setup(r => r.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(registryInterpreters));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isAny())).returns((file) => Promise.resolve(file === expectedCodnaPath));
        const condaExe = yield condaService.getCondaFile();
        assert.equal(condaExe, expectedCodnaPath, 'Failed to identify conda.exe');
    }));
    test('Must use Conda env from Registry to latest version of locate conda.exe', () => __awaiter(this, void 0, void 0, function* () {
        const condaPythonExePath = path.join('dumyPath', 'environments');
        const registryInterpreters = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda1', 'Scripts', 'python.exe'), companyDisplayName: 'Two 1', version: '1.11.0', type: contracts_1.InterpreterType.Conda },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda211', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.11', version: '2.11.0', type: contracts_1.InterpreterType.Conda },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda231', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.31', version: '2.31.0', type: contracts_1.InterpreterType.Conda },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda221', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.21', version: '2.21.0', type: contracts_1.InterpreterType.Conda },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.', type: contracts_1.InterpreterType.Unknown }
        ].map(item => {
            return Object.assign({}, info, item);
        });
        const indexOfLatestVersion = 3;
        const expectedCodnaPath = path.join(path.dirname(registryInterpreters[indexOfLatestVersion].path), 'conda.exe');
        platformService.setup(p => p.isWindows).returns(() => true);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService.setup(r => r.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(registryInterpreters));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isAny())).returns((file) => Promise.resolve(file === expectedCodnaPath));
        const condaExe = yield condaService.getCondaFile();
        assert.equal(condaExe, expectedCodnaPath, 'Failed to identify conda.exe');
    }));
    test('Must use \'conda\' if conda.exe cannot be located using registry entries', () => __awaiter(this, void 0, void 0, function* () {
        const condaPythonExePath = path.join('dumyPath', 'environments');
        const registryInterpreters = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda1', 'Scripts', 'python.exe'), companyDisplayName: 'Two 1', version: '1.11.0', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda211', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.11', version: '2.11.0', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda231', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.31', version: '2.31.0', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Anaconda', path: path.join(condaPythonExePath, 'conda221', 'Scripts', 'python.exe'), companyDisplayName: 'Two 2.21', version: '2.21.0', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.', type: contracts_1.InterpreterType.Unknown }
        ].map(item => { return Object.assign({}, info, item); });
        platformService.setup(p => p.isWindows).returns(() => true);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        registryInterpreterLocatorService.setup(r => r.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(registryInterpreters));
        fileSystem.setup(fs => fs.search(TypeMoq.It.isAnyString())).returns(() => __awaiter(this, void 0, void 0, function* () { return []; }));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isAny())).returns((file) => Promise.resolve(false));
        const condaExe = yield condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');
    }));
    test('Get conda file from default/known locations', () => __awaiter(this, void 0, void 0, function* () {
        const expected = 'C:/ProgramData/Miniconda2/Scripts/conda.exe';
        platformService.setup(p => p.isWindows).returns(() => true);
        fileSystem.setup(f => f.search(TypeMoq.It.isAnyString()))
            .returns(() => Promise.resolve([expected]));
        const CondaServiceForTesting = class extends condaService_1.CondaService {
            isCondaInCurrentPath() {
                return __awaiter(this, void 0, void 0, function* () { return false; });
            }
        };
        const condaSrv = new CondaServiceForTesting(serviceContainer.object);
        const result = yield condaSrv.getCondaFile();
        chai_1.expect(result).is.equal(expected);
    }));
    test('Must use \'python.condaPath\' setting if set', () => __awaiter(this, void 0, void 0, function* () {
        condaPathSetting = 'spam-spam-conda-spam-spam';
        // We ensure that conda would otherwise be found.
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version'])))
            .returns(() => Promise.resolve({ stdout: 'xyz' }))
            .verifiable(TypeMoq.Times.never());
        const condaExe = yield condaService.getCondaFile();
        assert.equal(condaExe, 'spam-spam-conda-spam-spam', 'Failed to identify conda.exe');
        // We should not try to call other unwanted methods.
        processService.verifyAll();
        platformService.verify(p => p.isWindows, TypeMoq.Times.never());
        registryInterpreterLocatorService.verify(r => r.getInterpreters(TypeMoq.It.isAny()), TypeMoq.Times.never());
    }));
    test('Must use \'conda\' if is available in the current path', () => __awaiter(this, void 0, void 0, function* () {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']))).returns(() => Promise.resolve({ stdout: 'xyz' }));
        const condaExe = yield condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');
        // We should not try to call other unwanted methods.
        platformService.verify(p => p.isWindows, TypeMoq.Times.never());
        registryInterpreterLocatorService.verify(r => r.getInterpreters(TypeMoq.It.isAny()), TypeMoq.Times.never());
    }));
    test('Must invoke process only once to check if conda is in the current path', () => __awaiter(this, void 0, void 0, function* () {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']))).returns(() => Promise.resolve({ stdout: 'xyz' }));
        const condaExe = yield condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify conda.exe');
        processService.verify(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
        // We should not try to call other unwanted methods.
        platformService.verify(p => p.isWindows, TypeMoq.Times.never());
        registryInterpreterLocatorService.verify(r => r.getInterpreters(TypeMoq.It.isAny()), TypeMoq.Times.never());
        yield condaService.getCondaFile();
        processService.verify(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    }));
    ['~/anaconda/bin/conda', '~/miniconda/bin/conda', '~/anaconda2/bin/conda',
        '~/miniconda2/bin/conda', '~/anaconda3/bin/conda', '~/miniconda3/bin/conda']
        .forEach(knownLocation => {
        test(`Must return conda path from known location '${knownLocation}' (non windows)`, () => __awaiter(this, void 0, void 0, function* () {
            const expectedCondaLocation = untildify(knownLocation);
            platformService.setup(p => p.isWindows).returns(() => false);
            processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
            fileSystem.setup(fs => fs.search(TypeMoq.It.isAny())).returns(() => Promise.resolve([expectedCondaLocation]));
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(expectedCondaLocation))).returns(() => Promise.resolve(true));
            const condaExe = yield condaService.getCondaFile();
            assert.equal(condaExe, expectedCondaLocation, 'Failed to identify');
        }));
    });
    test('Must return \'conda\' if conda could not be found in known locations', () => __awaiter(this, void 0, void 0, function* () {
        platformService.setup(p => p.isWindows).returns(() => false);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        fileSystem.setup(fs => fs.search(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isAny())).returns((file) => Promise.resolve(false));
        const condaExe = yield condaService.getCondaFile();
        assert.equal(condaExe, 'conda', 'Failed to identify');
    }));
    test('Correctly identify interpreter location relative to entironment path (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        const environmentPath = path.join('a', 'b', 'c');
        platformService.setup(p => p.isWindows).returns(() => false);
        const pythonPath = condaService.getInterpreterPath(environmentPath);
        assert.equal(pythonPath, path.join(environmentPath, 'bin', 'python'), 'Incorrect path');
    }));
    test('Correctly identify interpreter location relative to entironment path (windows)', () => __awaiter(this, void 0, void 0, function* () {
        const environmentPath = path.join('a', 'b', 'c');
        platformService.setup(p => p.isWindows).returns(() => true);
        const pythonPath = condaService.getInterpreterPath(environmentPath);
        assert.equal(pythonPath, path.join(environmentPath, 'python.exe'), 'Incorrect path');
    }));
    test('Returns condaInfo when conda exists', () => __awaiter(this, void 0, void 0, function* () {
        const expectedInfo = {
            envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                path.join(environmentsPath, 'conda', 'envs', 'scipy')],
            default_prefix: '',
            'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: JSON.stringify(expectedInfo) }));
        const condaInfo = yield condaService.getCondaInfo();
        assert.deepEqual(condaInfo, expectedInfo, 'Conda info does not match');
    }));
    test('Returns undefined if there\'s and error in getting the info', () => __awaiter(this, void 0, void 0, function* () {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('unknown')));
        const condaInfo = yield condaService.getCondaInfo();
        assert.equal(condaInfo, undefined, 'Conda info does not match');
    }));
    test('Returns conda environments when conda exists', () => __awaiter(this, void 0, void 0, function* () {
        const stateFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new mocks_1.MockState(undefined);
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isValue('CONDA_ENVIRONMENTS'), TypeMoq.It.isValue(undefined))).returns(() => state);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: '' }));
        const environments = yield condaService.getCondaEnvironments(true);
        assert.equal(environments, undefined, 'Conda environments do not match');
    }));
    test('Logs information message when conda does not exist', () => __awaiter(this, void 0, void 0, function* () {
        const stateFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new mocks_1.MockState(undefined);
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isValue('CONDA_ENVIRONMENTS'), TypeMoq.It.isValue(undefined))).returns(() => state);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        logger.setup(l => l.logInformation(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .verifiable(TypeMoq.Times.once());
        const environments = yield condaService.getCondaEnvironments(true);
        assert.equal(environments, undefined, 'Conda environments do not match');
        logger.verifyAll();
    }));
    test('Returns cached conda environments', () => __awaiter(this, void 0, void 0, function* () {
        const stateFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new mocks_1.MockState({ data: 'CachedInfo' });
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isValue('CONDA_ENVIRONMENTS'), TypeMoq.It.isValue(undefined))).returns(() => state);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: '' }));
        const environments = yield condaService.getCondaEnvironments(false);
        assert.equal(environments, 'CachedInfo', 'Conda environments do not match');
    }));
    test('Subsequent list of environments will be retrieved from cache', () => __awaiter(this, void 0, void 0, function* () {
        const stateFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new mocks_1.MockState(undefined);
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isValue('CONDA_ENVIRONMENTS'), TypeMoq.It.isValue(undefined))).returns(() => state);
        const envList = ['# conda environments:',
            '#',
            'base                  *  /Users/donjayamanne/anaconda3',
            'one                      /Users/donjayamanne/anaconda3/envs/one',
            'one two                  /Users/donjayamanne/anaconda3/envs/one two',
            'py27                     /Users/donjayamanne/anaconda3/envs/py27',
            'py36                     /Users/donjayamanne/anaconda3/envs/py36',
            'three                    /Users/donjayamanne/anaconda3/envs/three'];
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: envList.join(os_1.EOL) }));
        const environments = yield condaService.getCondaEnvironments(false);
        chai_1.expect(environments).lengthOf(6, 'Incorrect number of environments');
        chai_1.expect(state.data.data).lengthOf(6, 'Incorrect number of environments in cache');
        state.data.data = [];
        const environmentsFetchedAgain = yield condaService.getCondaEnvironments(false);
        chai_1.expect(environmentsFetchedAgain).lengthOf(0, 'Incorrect number of environments fetched from cache');
    }));
    test('Returns undefined if there\'s and error in getting the info', () => __awaiter(this, void 0, void 0, function* () {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['info', '--json']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('unknown')));
        const condaInfo = yield condaService.getCondaInfo();
        assert.equal(condaInfo, undefined, 'Conda info does not match');
    }));
    test('Must use Conda env from Registry to locate conda.exe', () => __awaiter(this, void 0, void 0, function* () {
        const condaPythonExePath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments', 'conda', 'Scripts', 'python.exe');
        const registryInterpreters = [
            { displayName: 'One', path: path.join(environmentsPath, 'path1', 'one.exe'), companyDisplayName: 'One 1', version: '1', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Anaconda', path: condaPythonExePath, companyDisplayName: 'Two 2', version: '1.11.0', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Three', path: path.join(environmentsPath, 'path2', 'one.exe'), companyDisplayName: 'Three 3', version: '2.10.1', type: contracts_1.InterpreterType.Unknown },
            { displayName: 'Seven', path: path.join(environmentsPath, 'conda', 'envs', 'numpy'), companyDisplayName: 'Continuum Analytics, Inc.', type: contracts_1.InterpreterType.Unknown }
        ].map(item => {
            return Object.assign({}, info, item);
        });
        const expectedCodaExe = path.join(path.dirname(condaPythonExePath), 'conda.exe');
        platformService.setup(p => p.isWindows).returns(() => true);
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Not Found')));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(expectedCodaExe))).returns(() => Promise.resolve(true));
        registryInterpreterLocatorService.setup(r => r.getInterpreters(TypeMoq.It.isAny())).returns(() => Promise.resolve(registryInterpreters));
        const condaExe = yield condaService.getCondaFile();
        assert.equal(condaExe, expectedCodaExe, 'Failed to identify conda.exe');
    }));
    test('isAvailable will return true if conda is available', () => __awaiter(this, void 0, void 0, function* () {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: '4.4.4' }));
        const isAvailable = yield condaService.isCondaAvailable();
        assert.equal(isAvailable, true);
    }));
    test('isAvailable will return false if conda is not available', () => __awaiter(this, void 0, void 0, function* () {
        condaService.getCondaFile = () => Promise.resolve('conda');
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('not found')));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        fileSystem.setup(fs => fs.search(TypeMoq.It.isAny())).returns(() => Promise.resolve([]));
        platformService.setup(p => p.isWindows).returns(() => false);
        condaService.getCondaInfo = () => Promise.reject('Not Found');
        const isAvailable = yield condaService.isCondaAvailable();
        assert.equal(isAvailable, false);
    }));
    test('Version info from conda process will be returned in getCondaVersion', () => __awaiter(this, void 0, void 0, function* () {
        condaService.getCondaInfo = () => Promise.reject('Not Found');
        condaService.getCondaFile = () => Promise.resolve('conda');
        const expectedVersion = semver_1.parse('4.4.4').raw;
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: '4.4.4' }));
        const version = yield condaService.getCondaVersion();
        assert.equal(version.raw, expectedVersion);
    }));
    test('isCondaInCurrentPath will return true if conda is available', () => __awaiter(this, void 0, void 0, function* () {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'xyz' }));
        const isAvailable = yield condaService.isCondaInCurrentPath();
        assert.equal(isAvailable, true);
    }));
    test('isCondaInCurrentPath will return false if conda is not available', () => __awaiter(this, void 0, void 0, function* () {
        processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('not found')));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        platformService.setup(p => p.isWindows).returns(() => false);
        const isAvailable = yield condaService.isCondaInCurrentPath();
        assert.equal(isAvailable, false);
    }));
    function testFailureOfGettingCondaEnvironments(isWindows, isOsx, isLinux, pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            platformService.setup(p => p.isLinux).returns(() => isLinux);
            platformService.setup(p => p.isWindows).returns(() => isWindows);
            platformService.setup(p => p.isMac).returns(() => isOsx);
            const stateFactory = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IPersistentStateFactory))).returns(() => stateFactory.object);
            const state = new mocks_1.MockState({ data: undefined });
            stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isValue('CONDA_ENVIRONMENTS'), TypeMoq.It.isValue(undefined))).returns(() => state);
            processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['--version']), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'some value' }));
            processService.setup(p => p.exec(TypeMoq.It.isValue('conda'), TypeMoq.It.isValue(['env', 'list']), TypeMoq.It.isAny())).returns(() => Promise.reject(new Error('Failed')));
            const condaEnv = yield condaService.getCondaEnvironment(pythonPath);
            chai_1.expect(condaEnv).to.be.equal(undefined, 'Conda should be undefined');
        });
    }
    test('Fails to identify an environment as a conda env (windows)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'python.exe');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        yield testFailureOfGettingCondaEnvironments(true, false, false, pythonPath);
    }));
    test('Fails to identify an environment as a conda env (linux)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'python');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        yield testFailureOfGettingCondaEnvironments(false, false, true, pythonPath);
    }));
    test('Fails to identify an environment as a conda env (osx)', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = path.join('c', 'users', 'xyz', '.conda', 'envs', 'one', 'python');
        fileSystem.setup(f => f.directoryExists(TypeMoq.It.isValue(path.join(path.dirname(pythonPath), 'conda-meta')))).returns(() => Promise.resolve(true));
        yield testFailureOfGettingCondaEnvironments(false, true, false, pythonPath);
    }));
    test('Create activated conda environment for Windows', () => __awaiter(this, void 0, void 0, function* () {
        const pythonInterpreter = Object.assign({}, info, { type: contracts_1.InterpreterType.Conda, envPath: 'C:\\Anaconda', envName: 'Anaconda' });
        const environment = { Path: 'C:\\test' };
        platformService.setup(p => p.isWindows).returns(() => true);
        const newEnvironment = condaService.getActivatedCondaEnvironment(pythonInterpreter, environment);
        // This part depends on the OS of path.join in getActivatedCondaEnvironment, so compute it here to match
        const expectedPath = path.join(pythonInterpreter.envPath, 'Scripts');
        chai_1.expect(newEnvironment.Path).to.be.equal(expectedPath.concat(';', environment.Path), 'Incorrect Windows Path Value');
        chai_1.expect(newEnvironment.CONDA_PREFIX).to.be.equal(pythonInterpreter.envPath, 'Incorrect Windows CONDA_PREFIX Value');
        chai_1.expect(newEnvironment.CONDA_DEFAULT_ENV).to.be.equal(pythonInterpreter.envName, 'Incorrect Windows CONDA_DEFAULT_ENV Value');
    }));
    test('Create activated conda environment for Non-Windows', () => __awaiter(this, void 0, void 0, function* () {
        const pythonInterpreter = Object.assign({}, info, { type: contracts_1.InterpreterType.Conda, envPath: 'usr/Anaconda', envName: 'Anaconda' });
        const environment = { PATH: 'usr/test' };
        platformService.setup(p => p.isWindows).returns(() => false);
        const newEnvironment = condaService.getActivatedCondaEnvironment(pythonInterpreter, environment);
        // This part depends on the OS of path.join in getActivatedCondaEnvironment, so compute it here to match
        const expectedPath = path.join('usr/Anaconda', 'bin');
        chai_1.expect(newEnvironment.PATH).to.be.equal(expectedPath.concat(':', environment.PATH), 'Incorrect Non-Windows Path Value');
        chai_1.expect(newEnvironment.CONDA_PREFIX).to.be.equal(pythonInterpreter.envPath, 'Incorrect Non-Windows CONDA_PREFIX Value');
        chai_1.expect(newEnvironment.CONDA_DEFAULT_ENV).to.be.equal(pythonInterpreter.envName, 'Incorrect Non-Windows CONDA_DEFAULT_ENV Value');
    }));
});
//# sourceMappingURL=condaService.unit.test.js.map