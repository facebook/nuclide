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
// tslint:disable:no-any max-func-body-length no-invalid-this
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/application/types");
const condaInstaller_1 = require("../../../client/common/installer/condaInstaller");
const pipEnvInstaller_1 = require("../../../client/common/installer/pipEnvInstaller");
const pipInstaller_1 = require("../../../client/common/installer/pipInstaller");
const productInstaller_1 = require("../../../client/common/installer/productInstaller");
const types_2 = require("../../../client/common/installer/types");
const types_3 = require("../../../client/common/terminal/types");
const types_4 = require("../../../client/common/types");
const enum_1 = require("../../../client/common/utils/enum");
const misc_1 = require("../../../client/common/utils/misc");
const contracts_1 = require("../../../client/interpreter/contracts");
/* Complex test to ensure we cover all combinations:
We could have written separate tests for each installer, but we'd be replicate code.
Both approachs have their benefits.

Comnbinations of:
1. With and without a workspace.
2. Http Proxy configuration.
3. All products.
4. Different versions of Python.
5. With and without conda.
6. Conda environments with names and without names.
7. All installers.
*/
suite('Module Installer', () => {
    const pythonPath = path.join(__dirname, 'python');
    [condaInstaller_1.CondaInstaller, pipInstaller_1.PipInstaller, pipEnvInstaller_1.PipEnvInstaller].forEach(installerClass => {
        // Proxy info is relevant only for PipInstaller.
        const proxyServers = installerClass === pipInstaller_1.PipInstaller ? ['', 'proxy:1234'] : [''];
        proxyServers.forEach(proxyServer => {
            [undefined, vscode_1.Uri.file('/users/dev/xyz')].forEach(resource => {
                // Conda info is relevant only for CondaInstaller.
                const condaEnvs = installerClass === condaInstaller_1.CondaInstaller ? [
                    { name: 'My-Env01', path: '' }, { name: '', path: path.join('conda', 'path') },
                    { name: 'My-Env01 With Spaces', path: '' }, { name: '', path: path.join('conda with spaces', 'path') }
                ] : [];
                [undefined, ...condaEnvs].forEach(condaEnvInfo => {
                    const testProxySuffix = proxyServer.length === 0 ? 'without proxy info' : 'with proxy info';
                    const testCondaEnv = condaEnvInfo ? (condaEnvInfo.name ? 'without conda name' : 'with conda path') : 'without conda';
                    const testSuite = [testProxySuffix, testCondaEnv].filter(item => item.length > 0).join(', ');
                    suite(`${installerClass.name} (${testSuite})`, () => {
                        let disposables = [];
                        let installer;
                        let installationChannel;
                        let serviceContainer;
                        let terminalService;
                        let pythonSettings;
                        let interpreterService;
                        const condaExecutable = 'my.exe';
                        setup(() => {
                            serviceContainer = TypeMoq.Mock.ofType();
                            disposables = [];
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);
                            installationChannel = TypeMoq.Mock.ofType();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IInstallationChannelManager), TypeMoq.It.isAny())).returns(() => installationChannel.object);
                            const condaService = TypeMoq.Mock.ofType();
                            condaService.setup(c => c.getCondaFile()).returns(() => Promise.resolve(condaExecutable));
                            condaService.setup(c => c.getCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(condaEnvInfo));
                            const configService = TypeMoq.Mock.ofType();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.IConfigurationService), TypeMoq.It.isAny())).returns(() => configService.object);
                            pythonSettings = TypeMoq.Mock.ofType();
                            pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
                            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
                            terminalService = TypeMoq.Mock.ofType();
                            const terminalServiceFactory = TypeMoq.Mock.ofType();
                            terminalServiceFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => terminalService.object);
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.ITerminalServiceFactory), TypeMoq.It.isAny())).returns(() => terminalServiceFactory.object);
                            interpreterService = TypeMoq.Mock.ofType();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IInterpreterService), TypeMoq.It.isAny())).returns(() => interpreterService.object);
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.ICondaService), TypeMoq.It.isAny())).returns(() => condaService.object);
                            const workspaceService = TypeMoq.Mock.ofType();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService), TypeMoq.It.isAny())).returns(() => workspaceService.object);
                            const http = TypeMoq.Mock.ofType();
                            http.setup(h => h.get(TypeMoq.It.isValue('proxy'), TypeMoq.It.isAny())).returns(() => proxyServer);
                            workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('http'))).returns(() => http.object);
                            installer = new installerClass(serviceContainer.object);
                        });
                        teardown(() => {
                            disposables.forEach(disposable => {
                                if (disposable) {
                                    disposable.dispose();
                                }
                            });
                        });
                        function setActiveInterpreter(activeInterpreter) {
                            interpreterService
                                .setup(i => i.getActiveInterpreter(TypeMoq.It.isValue(resource)))
                                .returns(() => Promise.resolve(activeInterpreter))
                                .verifiable(TypeMoq.Times.atLeastOnce());
                        }
                        getModuleNamesForTesting().forEach(product => {
                            const moduleName = product.moduleName;
                            function installModuleAndVerifyCommand(command, expectedArgs) {
                                return __awaiter(this, void 0, void 0, function* () {
                                    terminalService.setup(t => t.sendCommand(TypeMoq.It.isValue(command), TypeMoq.It.isValue(expectedArgs)))
                                        .returns(() => Promise.resolve())
                                        .verifiable(TypeMoq.Times.once());
                                    yield installer.installModule(moduleName, resource);
                                    terminalService.verifyAll();
                                });
                            }
                            if (product.value === types_4.Product.pylint) {
                                // tslint:disable-next-line:no-shadowed-variable
                                generatePythonInterpreterVersions().forEach(interpreterInfo => {
                                    const majorVersion = interpreterInfo.version_info[0];
                                    if (majorVersion === 2) {
                                        const testTitle = `Ensure install arg is \'pylint<2.0.0\' in ${interpreterInfo.version_info.join('.')}`;
                                        if (installerClass === pipInstaller_1.PipInstaller) {
                                            test(testTitle, () => __awaiter(this, void 0, void 0, function* () {
                                                setActiveInterpreter(interpreterInfo);
                                                const proxyArgs = proxyServer.length === 0 ? [] : ['--proxy', proxyServer];
                                                const expectedArgs = ['-m', 'pip', ...proxyArgs, 'install', '-U', '"pylint<2.0.0"'];
                                                yield installModuleAndVerifyCommand(pythonPath, expectedArgs);
                                            }));
                                        }
                                        if (installerClass === pipEnvInstaller_1.PipEnvInstaller) {
                                            test(testTitle, () => __awaiter(this, void 0, void 0, function* () {
                                                setActiveInterpreter(interpreterInfo);
                                                const expectedArgs = ['install', '"pylint<2.0.0"', '--dev'];
                                                yield installModuleAndVerifyCommand(pipEnvInstaller_1.pipenvName, expectedArgs);
                                            }));
                                        }
                                        if (installerClass === condaInstaller_1.CondaInstaller) {
                                            test(testTitle, () => __awaiter(this, void 0, void 0, function* () {
                                                setActiveInterpreter(interpreterInfo);
                                                const expectedArgs = ['install'];
                                                if (condaEnvInfo && condaEnvInfo.name) {
                                                    expectedArgs.push('--name');
                                                    expectedArgs.push(condaEnvInfo.name.toCommandArgument());
                                                }
                                                else if (condaEnvInfo && condaEnvInfo.path) {
                                                    expectedArgs.push('--prefix');
                                                    expectedArgs.push(condaEnvInfo.path.fileToCommandArgument());
                                                }
                                                expectedArgs.push('"pylint<2.0.0"');
                                                yield installModuleAndVerifyCommand(condaExecutable, expectedArgs);
                                            }));
                                        }
                                    }
                                    else {
                                        const testTitle = `Ensure install arg is \'pylint\' in ${interpreterInfo.version_info.join('.')}`;
                                        if (installerClass === pipInstaller_1.PipInstaller) {
                                            test(testTitle, () => __awaiter(this, void 0, void 0, function* () {
                                                setActiveInterpreter(interpreterInfo);
                                                const proxyArgs = proxyServer.length === 0 ? [] : ['--proxy', proxyServer];
                                                const expectedArgs = ['-m', 'pip', ...proxyArgs, 'install', '-U', 'pylint'];
                                                yield installModuleAndVerifyCommand(pythonPath, expectedArgs);
                                            }));
                                        }
                                        if (installerClass === pipEnvInstaller_1.PipEnvInstaller) {
                                            test(testTitle, () => __awaiter(this, void 0, void 0, function* () {
                                                setActiveInterpreter(interpreterInfo);
                                                const expectedArgs = ['install', 'pylint', '--dev'];
                                                yield installModuleAndVerifyCommand(pipEnvInstaller_1.pipenvName, expectedArgs);
                                            }));
                                        }
                                        if (installerClass === condaInstaller_1.CondaInstaller) {
                                            test(testTitle, () => __awaiter(this, void 0, void 0, function* () {
                                                setActiveInterpreter(interpreterInfo);
                                                const expectedArgs = ['install'];
                                                if (condaEnvInfo && condaEnvInfo.name) {
                                                    expectedArgs.push('--name');
                                                    expectedArgs.push(condaEnvInfo.name.toCommandArgument());
                                                }
                                                else if (condaEnvInfo && condaEnvInfo.path) {
                                                    expectedArgs.push('--prefix');
                                                    expectedArgs.push(condaEnvInfo.path.fileToCommandArgument());
                                                }
                                                expectedArgs.push('pylint');
                                                yield installModuleAndVerifyCommand(condaExecutable, expectedArgs);
                                            }));
                                        }
                                    }
                                });
                                return;
                            }
                            if (installerClass === pipInstaller_1.PipInstaller) {
                                test(`Ensure getActiveInterperter is used in PipInstaller (${product.name})`, () => __awaiter(this, void 0, void 0, function* () {
                                    setActiveInterpreter();
                                    try {
                                        yield installer.installModule(product.name, resource);
                                    }
                                    catch (_a) {
                                        misc_1.noop();
                                    }
                                    interpreterService.verifyAll();
                                }));
                            }
                            if (installerClass === pipInstaller_1.PipInstaller) {
                                test(`Test Args (${product.name})`, () => __awaiter(this, void 0, void 0, function* () {
                                    setActiveInterpreter();
                                    const proxyArgs = proxyServer.length === 0 ? [] : ['--proxy', proxyServer];
                                    const expectedArgs = ['-m', 'pip', ...proxyArgs, 'install', '-U', moduleName];
                                    yield installModuleAndVerifyCommand(pythonPath, expectedArgs);
                                    interpreterService.verifyAll();
                                }));
                            }
                            if (installerClass === pipEnvInstaller_1.PipEnvInstaller) {
                                test(`Test args (${product.name})`, () => __awaiter(this, void 0, void 0, function* () {
                                    setActiveInterpreter();
                                    const expectedArgs = ['install', moduleName, '--dev'];
                                    yield installModuleAndVerifyCommand(pipEnvInstaller_1.pipenvName, expectedArgs);
                                }));
                            }
                            if (installerClass === condaInstaller_1.CondaInstaller) {
                                test(`Test args (${product.name})`, () => __awaiter(this, void 0, void 0, function* () {
                                    setActiveInterpreter();
                                    const expectedArgs = ['install'];
                                    if (condaEnvInfo && condaEnvInfo.name) {
                                        expectedArgs.push('--name');
                                        expectedArgs.push(condaEnvInfo.name.toCommandArgument());
                                    }
                                    else if (condaEnvInfo && condaEnvInfo.path) {
                                        expectedArgs.push('--prefix');
                                        expectedArgs.push(condaEnvInfo.path.fileToCommandArgument());
                                    }
                                    expectedArgs.push(moduleName);
                                    yield installModuleAndVerifyCommand(condaExecutable, expectedArgs);
                                }));
                            }
                        });
                    });
                });
            });
        });
    });
});
function generatePythonInterpreterVersions() {
    const versions = [[2, 7, 0, 'final'], [3, 4, 0, 'final'], [3, 5, 0, 'final'], [3, 6, 0, 'final'], [3, 7, 0, 'final']];
    return versions.map(version => {
        const info = TypeMoq.Mock.ofType();
        info.setup((t) => t.then).returns(() => undefined);
        info.setup(t => t.type).returns(() => contracts_1.InterpreterType.VirtualEnv);
        info.setup(t => t.version_info).returns(() => version);
        return info.object;
    });
}
function getModuleNamesForTesting() {
    return enum_1.getNamesAndValues(types_4.Product)
        .map(product => {
        let moduleName = '';
        const mockSvc = TypeMoq.Mock.ofType().object;
        const mockOutChnl = TypeMoq.Mock.ofType().object;
        try {
            const prodInstaller = new productInstaller_1.ProductInstaller(mockSvc, mockOutChnl);
            moduleName = prodInstaller.translateProductToModuleName(product.value, types_4.ModuleNamePurpose.install);
            return { name: product.name, value: product.value, moduleName };
        }
        catch (_a) {
            return;
        }
    })
        .filter(item => item !== undefined);
}
//# sourceMappingURL=moduleInstaller.unit.test.js.map