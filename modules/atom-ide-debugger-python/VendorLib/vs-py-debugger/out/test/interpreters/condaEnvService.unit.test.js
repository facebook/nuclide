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
const assert = require("assert");
const path = require("path");
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/types");
const contracts_1 = require("../../client/interpreter/contracts");
const conda_1 = require("../../client/interpreter/locators/services/conda");
const condaEnvService_1 = require("../../client/interpreter/locators/services/condaEnvService");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const mocks_1 = require("./mocks");
const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
// tslint:disable-next-line:max-func-body-length
suite('Interpreters from Conda Environments', () => {
    let ioc;
    let logger;
    let condaProvider;
    let condaService;
    let interpreterHelper;
    let fileSystem;
    setup(() => {
        initializeDI();
        const serviceContainer = TypeMoq.Mock.ofType();
        const stateFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new mocks_1.MockState(undefined);
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => state);
        condaService = TypeMoq.Mock.ofType();
        interpreterHelper = TypeMoq.Mock.ofType();
        fileSystem = TypeMoq.Mock.ofType();
        condaProvider = new condaEnvService_1.CondaEnvService(condaService.object, interpreterHelper.object, logger.object, serviceContainer.object, fileSystem.object);
    });
    teardown(() => ioc.dispose());
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        logger = TypeMoq.Mock.ofType();
    }
    test('Must return an empty list for empty json', () => __awaiter(this, void 0, void 0, function* () {
        const interpreters = yield condaEnvService_1.parseCondaInfo(
        // tslint:disable-next-line:no-any prefer-type-cast
        {}, condaService.object, fileSystem.object, interpreterHelper.object);
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    }));
    function extractDisplayNameFromVersionInfo(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                    path.join(environmentsPath, 'conda', 'envs', 'scipy')],
                default_prefix: '',
                'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
            };
            condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
            info.envs.forEach(validPath => {
                const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            });
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: '' }));
            const interpreters = yield condaEnvService_1.parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
            assert.equal(interpreters.length, 2, 'Incorrect number of entries');
            const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
            assert.equal(interpreters[0].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[0].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
            const path2 = path.join(info.envs[1], isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[1].path, path2, 'Incorrect path for first env');
            assert.equal(interpreters[1].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[1].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
        });
    }
    test('Must extract display name from version info (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield extractDisplayNameFromVersionInfo(false);
    }));
    test('Must extract display name from version info (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield extractDisplayNameFromVersionInfo(true);
    }));
    function extractDisplayNameFromVersionInfoSuffixedWithEnvironmentName(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                    path.join(environmentsPath, 'conda', 'envs', 'scipy')],
                default_prefix: path.join(environmentsPath, 'conda', 'envs', 'root'),
                'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
            };
            condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
            info.envs.forEach(validPath => {
                const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            });
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: '' }));
            condaService.setup(c => c.getCondaFile()).returns(() => Promise.resolve('conda'));
            condaService.setup(c => c.getCondaInfo()).returns(() => Promise.resolve(info));
            condaService.setup(c => c.getCondaEnvironments(TypeMoq.It.isAny())).returns(() => Promise.resolve([
                { name: 'base', path: environmentsPath },
                { name: 'numpy', path: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
                { name: 'scipy', path: path.join(environmentsPath, 'conda', 'envs', 'scipy') }
            ]));
            fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p1, p2) => isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase());
            const interpreters = yield condaProvider.getInterpreters();
            assert.equal(interpreters.length, 2, 'Incorrect number of entries');
            const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
            assert.equal(interpreters[0].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[0].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
            const path2 = path.join(info.envs[1], isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[1].path, path2, 'Incorrect path for first env');
            assert.equal(interpreters[1].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[1].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
        });
    }
    test('Must extract display name from version info suffixed with the environment name (oxs/linux)', () => __awaiter(this, void 0, void 0, function* () {
        yield extractDisplayNameFromVersionInfoSuffixedWithEnvironmentName(false);
    }));
    test('Must extract display name from version info suffixed with the environment name (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield extractDisplayNameFromVersionInfoSuffixedWithEnvironmentName(true);
    }));
    function useDefaultNameIfSysVersionIsInvalid(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')],
                default_prefix: '',
                'sys.version': '3.6.1 |Anaonda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
            };
            condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
            info.envs.forEach(validPath => {
                const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            });
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: '' }));
            const interpreters = yield condaEnvService_1.parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
            assert.equal(interpreters[0].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[0].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
        });
    }
    test('Must use the default display name if sys.version is invalid (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield useDefaultNameIfSysVersionIsInvalid(false);
    }));
    test('Must use the default display name if sys.version is invalid (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield useDefaultNameIfSysVersionIsInvalid(true);
    }));
    function useDefaultNameIfSysVersionIsValidAndSuffixWithEnvironmentName(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')],
                default_prefix: '',
                'sys.version': '3.6.1 |Anaonda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
            };
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: '' }));
            condaService.setup(c => c.getCondaInfo()).returns(() => Promise.resolve(info));
            condaService.setup(c => c.getCondaEnvironments(TypeMoq.It.isAny())).returns(() => Promise.resolve([
                { name: 'base', path: environmentsPath },
                { name: 'numpy', path: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
                { name: 'scipy', path: path.join(environmentsPath, 'conda', 'envs', 'scipy') }
            ]));
            condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
            info.envs.forEach(validPath => {
                const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            });
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
            fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p1, p2) => isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase());
            const interpreters = yield condaProvider.getInterpreters();
            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
            assert.equal(interpreters[0].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[0].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
        });
    }
    test('Must use the default display name if sys.version is invalid and suffixed with environment name (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield useDefaultNameIfSysVersionIsValidAndSuffixWithEnvironmentName(false);
    }));
    test('Must use the default display name if sys.version is invalid and suffixed with environment name (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield useDefaultNameIfSysVersionIsValidAndSuffixWithEnvironmentName(false);
    }));
    function useDefaultNameIfSysVersionIsEmpty(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')]
            };
            condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
            info.envs.forEach(validPath => {
                const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            });
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: '' }));
            const interpreters = yield condaEnvService_1.parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
            assert.equal(interpreters[0].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[0].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
        });
    }
    test('Must use the default display name if sys.version is empty (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield useDefaultNameIfSysVersionIsEmpty(false);
    }));
    test('Must use the default display name if sys.version is empty (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield useDefaultNameIfSysVersionIsEmpty(true);
    }));
    function useDefaultNameIfSysVersionIsEmptyAndSuffixWithEnvironmentName(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy')]
            };
            condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
            info.envs.forEach(validPath => {
                const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            });
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: '' }));
            condaService.setup(c => c.getCondaFile()).returns(() => Promise.resolve('conda'));
            condaService.setup(c => c.getCondaInfo()).returns(() => Promise.resolve(info));
            condaService.setup(c => c.getCondaEnvironments(TypeMoq.It.isAny())).returns(() => Promise.resolve([
                { name: 'base', path: environmentsPath },
                { name: 'numpy', path: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
                { name: 'scipy', path: path.join(environmentsPath, 'conda', 'envs', 'scipy') }
            ]));
            fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p1, p2) => isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase());
            const interpreters = yield condaProvider.getInterpreters();
            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            const path1 = path.join(info.envs[0], isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
            assert.equal(interpreters[0].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[0].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
        });
    }
    test('Must use the default display name if sys.version is empty and suffixed with environment name (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield useDefaultNameIfSysVersionIsEmptyAndSuffixWithEnvironmentName(false);
    }));
    test('Must use the default display name if sys.version is empty and suffixed with environment name (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield useDefaultNameIfSysVersionIsEmptyAndSuffixWithEnvironmentName(true);
    }));
    function includeDefaultPrefixIntoListOfInterpreters(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                default_prefix: path.join(environmentsPath, 'conda', 'envs', 'numpy')
            };
            condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
            const pythonPath = isWindows ? path.join(info.default_prefix, 'python.exe') : path.join(info.default_prefix, 'bin', 'python');
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: '' }));
            const interpreters = yield condaEnvService_1.parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
            const path1 = path.join(info.default_prefix, isWindows ? 'python.exe' : path.join('bin', 'python'));
            assert.equal(interpreters[0].path, path1, 'Incorrect path for first env');
            assert.equal(interpreters[0].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect company display name for first env');
            assert.equal(interpreters[0].type, contracts_1.InterpreterType.Conda, 'Environment not detected as a conda environment');
        });
    }
    test('Must include the default_prefix into the list of interpreters (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield includeDefaultPrefixIntoListOfInterpreters(false);
    }));
    test('Must include the default_prefix into the list of interpreters (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield includeDefaultPrefixIntoListOfInterpreters(true);
    }));
    function excludeInterpretersThatDoNotExistOnFileSystem(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = {
                envs: [path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                    path.join(environmentsPath, 'path0', 'one.exe'),
                    path.join(environmentsPath, 'path1', 'one.exe'),
                    path.join(environmentsPath, 'path2', 'one.exe'),
                    path.join(environmentsPath, 'conda', 'envs', 'scipy'),
                    path.join(environmentsPath, 'path3', 'three.exe')]
            };
            const validPaths = info.envs.filter((_, index) => index % 2 === 0);
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: '' }));
            validPaths.forEach(envPath => {
                condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isValue(envPath))).returns(environmentPath => {
                    return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
                });
                const pythonPath = isWindows ? path.join(envPath, 'python.exe') : path.join(envPath, 'bin', 'python');
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            });
            const interpreters = yield condaEnvService_1.parseCondaInfo(info, condaService.object, fileSystem.object, interpreterHelper.object);
            assert.equal(interpreters.length, validPaths.length, 'Incorrect number of entries');
            validPaths.forEach((envPath, index) => {
                assert.equal(interpreters[index].envPath, envPath, 'Incorrect env path');
                const pythonPath = isWindows ? path.join(envPath, 'python.exe') : path.join(envPath, 'bin', 'python');
                assert.equal(interpreters[index].path, pythonPath, 'Incorrect python Path');
            });
        });
    }
    test('Must exclude interpreters that do not exist on disc (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield excludeInterpretersThatDoNotExistOnFileSystem(false);
    }));
    test('Must exclude interpreters that do not exist on disc (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield excludeInterpretersThatDoNotExistOnFileSystem(true);
    }));
});
//# sourceMappingURL=condaEnvService.unit.test.js.map