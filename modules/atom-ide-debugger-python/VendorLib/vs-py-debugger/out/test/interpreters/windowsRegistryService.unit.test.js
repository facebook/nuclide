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
const types_1 = require("../../client/common/platform/types");
const types_2 = require("../../client/common/types");
const platform_1 = require("../../client/common/utils/platform");
const contracts_1 = require("../../client/interpreter/contracts");
const windowsRegistryService_1 = require("../../client/interpreter/locators/services/windowsRegistryService");
const mocks_1 = require("./mocks");
const environmentsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'environments');
// tslint:disable-next-line:max-func-body-length
suite('Interpreters from Windows Registry (unit)', () => {
    let serviceContainer;
    let interpreterHelper;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        const stateFactory = TypeMoq.Mock.ofType();
        interpreterHelper = TypeMoq.Mock.ofType();
        const pathUtils = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IPersistentStateFactory))).returns(() => stateFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IInterpreterHelper))).returns(() => interpreterHelper.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IPathUtils))).returns(() => pathUtils.object);
        pathUtils.setup(p => p.basename(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((p) => p.split(/[\\,\/]/).reverse()[0]);
        const state = new mocks_1.MockState(undefined);
        // tslint:disable-next-line:no-empty no-any
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));
        stateFactory.setup(s => s.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => state);
    });
    test('Must return an empty list (x86)', () => __awaiter(this, void 0, void 0, function* () {
        const registry = new mocks_1.MockRegistry([], []);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, false, serviceContainer.object);
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    }));
    test('Must return an empty list (x64)', () => __awaiter(this, void 0, void 0, function* () {
        const registry = new mocks_1.MockRegistry([], []);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, true, serviceContainer.object);
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    }));
    test('Must return a single entry', () => __awaiter(this, void 0, void 0, function* () {
        const registryKeys = [
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One'] },
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path1') },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path1', 'one.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company One\\Tag1', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Version.Tag1', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company One\\Tag1', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' }
        ];
        const registry = new mocks_1.MockRegistry(registryKeys, registryValues);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, false, serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: platform_1.Architecture.x86 }));
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'path1', 'one.exe'), 'Incorrect executable path');
        assert.equal(interpreters[0].version, 'Version.Tag1', 'Incorrect version');
    }));
    test('Must default names for PythonCore and exe', () => __awaiter(this, void 0, void 0, function* () {
        const registryKeys = [
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\PythonCore'] },
            { key: '\\Software\\Python\\PythonCore', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\PythonCore\\Tag1'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\PythonCore\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path1') }
        ];
        const registry = new mocks_1.MockRegistry(registryKeys, registryValues);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, false, serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: platform_1.Architecture.x86 }));
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Python Software Foundation', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'path1', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');
    }));
    test('Must ignore company \'PyLauncher\'', () => __awaiter(this, void 0, void 0, function* () {
        const registryKeys = [
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\PyLauncher'] },
            { key: '\\Software\\Python\\PythonCore', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\PyLauncher\\Tag1'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\PyLauncher\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'c:/temp/Install Path Tag1' }
        ];
        const registry = new mocks_1.MockRegistry(registryKeys, registryValues);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, false, serviceContainer.object);
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 0, 'Incorrect number of entries');
    }));
    test('Must return a single entry and when registry contains only the InstallPath', () => __awaiter(this, void 0, void 0, function* () {
        const registryKeys = [
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One'] },
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path1') }
        ];
        const registry = new mocks_1.MockRegistry(registryKeys, registryValues);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, false, serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: platform_1.Architecture.x86 }));
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 1, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Company One', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'path1', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');
    }));
    test('Must return multiple entries', () => __awaiter(this, void 0, void 0, function* () {
        const registryKeys = [
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One', '\\Software\\Python\\Company Two', '\\Software\\Python\\Company Three'] },
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1', '\\Software\\Python\\Company One\\Tag2'] },
            { key: '\\Software\\Python\\Company Two', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Two\\Tag A', '\\Software\\Python\\Company Two\\Tag B', '\\Software\\Python\\Company Two\\Tag C'] },
            { key: '\\Software\\Python\\Company Three', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Three\\Tag !'] },
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, values: ['A'] },
            { key: '\\Software\\Python\\Company A', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, values: ['Another Tag'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path1') },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path1', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path2'), name: 'SysVersion' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path2') },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path2', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path3') },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Version.Tag A', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'DisplayName.Tag B', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company Two\\Tag C\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'scipy') },
            { key: '\\Software\\Python\\Company Three\\Tag !\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company A\\Another Tag\\InstallPath', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'scipy', 'python.exe') }
        ];
        const registry = new mocks_1.MockRegistry(registryKeys, registryValues);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, false, serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: platform_1.Architecture.x86 }));
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 4, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'path1', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');
        assert.equal(interpreters[1].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[1].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[1].path, path.join(environmentsPath, 'path2', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[1].version, 'Tag2', 'Incorrect version');
        assert.equal(interpreters[2].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[2].companyDisplayName, 'Company Two', 'Incorrect company name');
        assert.equal(interpreters[2].path, path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[2].version, 'Tag B', 'Incorrect version');
    }));
    test('Must return multiple entries excluding the invalid registry items and duplicate paths', () => __awaiter(this, void 0, void 0, function* () {
        const registryKeys = [
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One', '\\Software\\Python\\Company Two', '\\Software\\Python\\Company Three', '\\Software\\Python\\Company Four', '\\Software\\Python\\Company Five', 'Missing Tag'] },
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1', '\\Software\\Python\\Company One\\Tag2'] },
            { key: '\\Software\\Python\\Company Two', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Two\\Tag A', '\\Software\\Python\\Company Two\\Tag B', '\\Software\\Python\\Company Two\\Tag C'] },
            { key: '\\Software\\Python\\Company Three', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Three\\Tag !'] },
            { key: '\\Software\\Python\\Company Four', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Four\\Four !'] },
            { key: '\\Software\\Python\\Company Five', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Five\\Five !'] },
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, values: ['A'] },
            { key: '\\Software\\Python\\Company A', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, values: ['Another Tag'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Version.Tag1', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'scipy') },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'scipy', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path1') },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Version.Tag A', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path2') },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'DisplayName.Tag B', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company Two\\Tag C\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            // tslint:disable-next-line:no-any
            { key: '\\Software\\Python\\Company Five\\Five !\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: undefined },
            { key: '\\Software\\Python\\Company Three\\Tag !\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company A\\Another Tag\\InstallPath', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') }
        ];
        const registry = new mocks_1.MockRegistry(registryKeys, registryValues);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, false, serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: platform_1.Architecture.x86 }));
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 4, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', 'Incorrect version');
        assert.equal(interpreters[1].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[1].companyDisplayName, 'Display Name for Company One', 'Incorrect company name');
        assert.equal(interpreters[1].path, path.join(environmentsPath, 'conda', 'envs', 'scipy', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[1].version, 'Tag2', 'Incorrect version');
        assert.equal(interpreters[2].architecture, platform_1.Architecture.x86, 'Incorrect arhictecture');
        assert.equal(interpreters[2].companyDisplayName, 'Company Two', 'Incorrect company name');
        assert.equal(interpreters[2].path, path.join(environmentsPath, 'path1', 'python.exe'), 'Incorrect path');
        assert.equal(interpreters[2].version, 'Tag A', 'Incorrect version');
    }));
    test('Must return multiple entries excluding the invalid registry items and nonexistent paths', () => __awaiter(this, void 0, void 0, function* () {
        const registryKeys = [
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One', '\\Software\\Python\\Company Two', '\\Software\\Python\\Company Three', '\\Software\\Python\\Company Four', '\\Software\\Python\\Company Five', 'Missing Tag'] },
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company One\\Tag1', '\\Software\\Python\\Company One\\Tag2'] },
            { key: '\\Software\\Python\\Company Two', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Two\\Tag A', '\\Software\\Python\\Company Two\\Tag B', '\\Software\\Python\\Company Two\\Tag C'] },
            { key: '\\Software\\Python\\Company Three', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Three\\Tag !'] },
            { key: '\\Software\\Python\\Company Four', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Four\\Four !'] },
            { key: '\\Software\\Python\\Company Five', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, values: ['\\Software\\Python\\Company Five\\Five !'] },
            { key: '\\Software\\Python', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, values: ['A'] },
            { key: '\\Software\\Python\\Company A', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, values: ['Another Tag'] }
        ];
        const registryValues = [
            { key: '\\Software\\Python\\Company One', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Display Name for Company One', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Version.Tag1', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company One\\Tag1\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'DisplayName.Tag1', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'scipy') },
            { key: '\\Software\\Python\\Company One\\Tag2\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'scipy', 'python.exe'), name: 'ExecutablePath' },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'non-existent-path') },
            { key: '\\Software\\Python\\Company Two\\Tag A\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'Version.Tag A', name: 'SysVersion' },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'path2') },
            { key: '\\Software\\Python\\Company Two\\Tag B\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: 'DisplayName.Tag B', name: 'DisplayName' },
            { key: '\\Software\\Python\\Company Two\\Tag C\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'numpy') },
            // tslint:disable-next-line:no-any
            { key: '\\Software\\Python\\Company Five\\Five !\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: undefined },
            { key: '\\Software\\Python\\Company Three\\Tag !\\InstallPath', hive: types_1.RegistryHive.HKCU, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'numpy') },
            { key: '\\Software\\Python\\Company A\\Another Tag\\InstallPath', hive: types_1.RegistryHive.HKLM, arch: platform_1.Architecture.x86, value: path.join(environmentsPath, 'non-existent-path', 'envs', 'numpy') }
        ];
        const registry = new mocks_1.MockRegistry(registryKeys, registryValues);
        const winRegistry = new windowsRegistryService_1.WindowsRegistryService(registry, false, serviceContainer.object);
        interpreterHelper.reset();
        interpreterHelper.setup(h => h.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ architecture: platform_1.Architecture.x86 }));
        const interpreters = yield winRegistry.getInterpreters();
        assert.equal(interpreters.length, 2, 'Incorrect number of entries');
        assert.equal(interpreters[0].architecture, platform_1.Architecture.x86, '1. Incorrect arhictecture');
        assert.equal(interpreters[0].companyDisplayName, 'Display Name for Company One', '1. Incorrect company name');
        assert.equal(interpreters[0].path, path.join(environmentsPath, 'conda', 'envs', 'numpy', 'python.exe'), '1. Incorrect path');
        assert.equal(interpreters[0].version, 'Tag1', '1. Incorrect version');
        assert.equal(interpreters[1].architecture, platform_1.Architecture.x86, '2. Incorrect arhictecture');
        assert.equal(interpreters[1].companyDisplayName, 'Company Two', '2. Incorrect company name');
        assert.equal(interpreters[1].path, path.join(environmentsPath, 'path2', 'python.exe'), '2. Incorrect path');
        assert.equal(interpreters[1].version, 'Tag B', '2. Incorrect version');
    }));
});
//# sourceMappingURL=windowsRegistryService.unit.test.js.map