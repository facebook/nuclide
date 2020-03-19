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
const os_1 = require("os");
const path = require("path");
const TypeMoq = require("typemoq");
const types_1 = require("../../client/common/types");
const contracts_1 = require("../../client/interpreter/contracts");
const conda_1 = require("../../client/interpreter/locators/services/conda");
const condaEnvFileService_1 = require("../../client/interpreter/locators/services/condaEnvFileService");
const mocks_1 = require("./mocks");
const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
const environmentsFilePath = path.join(environmentsPath, 'environments.txt');
// tslint:disable-next-line:max-func-body-length
suite('Interpreters from Conda Environments Text File', () => {
    let logger;
    let condaService;
    let interpreterHelper;
    let condaFileProvider;
    let fileSystem;
    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType();
        const stateFactory = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IPersistentStateFactory))).returns(() => stateFactory.object);
        const state = new mocks_1.MockState(undefined);
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => state);
        condaService = TypeMoq.Mock.ofType();
        interpreterHelper = TypeMoq.Mock.ofType();
        fileSystem = TypeMoq.Mock.ofType();
        logger = TypeMoq.Mock.ofType();
        condaFileProvider = new condaEnvFileService_1.CondaEnvFileService(interpreterHelper.object, condaService.object, fileSystem.object, serviceContainer.object, logger.object);
    });
    test('Must return an empty list if environment file cannot be found', () => __awaiter(this, void 0, void 0, function* () {
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => undefined);
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: 'Mock Name' }));
        const interpreters = yield condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    }));
    test('Must return an empty list for an empty file', () => __awaiter(this, void 0, void 0, function* () {
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => environmentsFilePath);
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(true));
        fileSystem.setup(fs => fs.readFile(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(''));
        interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: 'Mock Name' }));
        const interpreters = yield condaFileProvider.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    }));
    function filterFilesInEnvironmentsFileAndReturnValidItems(isWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const validPaths = [
                path.join(environmentsPath, 'conda', 'envs', 'numpy'),
                path.join(environmentsPath, 'conda', 'envs', 'scipy')
            ];
            const interpreterPaths = [
                path.join(environmentsPath, 'xyz', 'one'),
                path.join(environmentsPath, 'xyz', 'two'),
                path.join(environmentsPath, 'xyz', 'python.exe')
            ].concat(validPaths);
            condaService.setup(c => c.condaEnvironmentsFile).returns(() => environmentsFilePath);
            condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(environmentPath => {
                return isWindows ? path.join(environmentPath, 'python.exe') : path.join(environmentPath, 'bin', 'python');
            });
            condaService.setup(c => c.getCondaEnvironments(TypeMoq.It.isAny())).returns(() => {
                const condaEnvironments = validPaths.map(item => {
                    return {
                        path: item,
                        name: path.basename(item)
                    };
                });
                return Promise.resolve(condaEnvironments);
            });
            fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(true));
            fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p1, p2) => isWindows ? p1 === p2 : p1.toUpperCase() === p2.toUpperCase());
            validPaths.forEach(validPath => {
                const pythonPath = isWindows ? path.join(validPath, 'python.exe') : path.join(validPath, 'bin', 'python');
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
            });
            fileSystem.setup(fs => fs.readFile(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(interpreterPaths.join(os_1.EOL)));
            interpreterHelper.setup(i => i.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: 'Mock Name' }));
            const interpreters = yield condaFileProvider.getInterpreters();
            const expectedPythonPath = isWindows ? path.join(validPaths[0], 'python.exe') : path.join(validPaths[0], 'bin', 'python');
            assert.equal(interpreters.length, 2, 'Incorrect number of entries');
            assert.equal(interpreters[0].companyDisplayName, conda_1.AnacondaCompanyName, 'Incorrect display name');
            assert.equal(interpreters[0].path, expectedPythonPath, 'Incorrect path');
            assert.equal(interpreters[0].envPath, validPaths[0], 'Incorrect envpath');
            assert.equal(interpreters[0].type, contracts_1.InterpreterType.Conda, 'Incorrect type');
        });
    }
    test('Must filter files in the list and return valid items (non windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield filterFilesInEnvironmentsFileAndReturnValidItems(false);
    }));
    test('Must filter files in the list and return valid items (windows)', () => __awaiter(this, void 0, void 0, function* () {
        yield filterFilesInEnvironmentsFileAndReturnValidItems(true);
    }));
    test('Must strip company name from version info', () => __awaiter(this, void 0, void 0, function* () {
        const interpreterPaths = [
            path.join(environmentsPath, 'conda', 'envs', 'numpy')
        ];
        const pythonPath = path.join(interpreterPaths[0], 'pythonPath');
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => environmentsFilePath);
        condaService.setup(c => c.getInterpreterPath(TypeMoq.It.isAny())).returns(() => pythonPath);
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true));
        fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(true));
        fileSystem.setup(fs => fs.readFile(TypeMoq.It.isValue(environmentsFilePath))).returns(() => Promise.resolve(interpreterPaths.join(os_1.EOL)));
        for (const companyName of conda_1.AnacondaCompanyNames) {
            const versionWithCompanyName = `Mock Version :: ${companyName}`;
            interpreterHelper.setup(c => c.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: versionWithCompanyName }));
            const interpreters = yield condaFileProvider.getInterpreters();
            assert.equal(interpreters.length, 1, 'Incorrect number of entries');
        }
    }));
});
//# sourceMappingURL=condaEnvFileService.unit.test.js.map