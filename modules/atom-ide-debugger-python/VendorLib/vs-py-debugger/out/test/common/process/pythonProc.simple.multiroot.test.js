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
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const child_process_1 = require("child_process");
const fs = require("fs-extra");
const inversify_1 = require("inversify");
const os_1 = require("os");
const path = require("path");
const vscode_1 = require("vscode");
const configSettings_1 = require("../../../client/common/configSettings");
const service_1 = require("../../../client/common/configuration/service");
const fileSystem_1 = require("../../../client/common/platform/fileSystem");
const pathUtils_1 = require("../../../client/common/platform/pathUtils");
const platformService_1 = require("../../../client/common/platform/platformService");
const types_1 = require("../../../client/common/platform/types");
const currentProcess_1 = require("../../../client/common/process/currentProcess");
const serviceRegistry_1 = require("../../../client/common/process/serviceRegistry");
const types_2 = require("../../../client/common/process/types");
const types_3 = require("../../../client/common/types");
const util_1 = require("../../../client/common/util");
const platform_1 = require("../../../client/common/utils/platform");
const serviceRegistry_2 = require("../../../client/common/variables/serviceRegistry");
const container_1 = require("../../../client/ioc/container");
const serviceManager_1 = require("../../../client/ioc/serviceManager");
const types_4 = require("../../../client/ioc/types");
const common_1 = require("../../common");
const initialize_1 = require("./../../initialize");
chai_1.use(chaiAsPromised);
const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace4Path = vscode_1.Uri.file(path.join(multirootPath, 'workspace4'));
const workspace4PyFile = vscode_1.Uri.file(path.join(workspace4Path.fsPath, 'one.py'));
// tslint:disable-next-line:max-func-body-length
suite('PythonExecutableService', () => {
    let cont;
    let serviceContainer;
    let configService;
    let pythonExecFactory;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!initialize_1.IS_MULTI_ROOT_TEST) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            yield common_1.clearPythonPathInWorkspaceFolder(workspace4Path);
            yield initialize_1.initialize();
        });
    });
    setup(() => __awaiter(this, void 0, void 0, function* () {
        cont = new inversify_1.Container();
        serviceContainer = new container_1.ServiceContainer(cont);
        const serviceManager = new serviceManager_1.ServiceManager(cont);
        serviceManager.addSingletonInstance(types_4.IServiceContainer, serviceContainer);
        serviceManager.addSingletonInstance(types_3.IDisposableRegistry, []);
        serviceManager.addSingletonInstance(types_3.IsWindows, util_1.IS_WINDOWS);
        serviceManager.addSingleton(types_3.IPathUtils, pathUtils_1.PathUtils);
        serviceManager.addSingleton(types_3.ICurrentProcess, currentProcess_1.CurrentProcess);
        serviceManager.addSingleton(types_3.IConfigurationService, service_1.ConfigurationService);
        serviceManager.addSingleton(types_1.IPlatformService, platformService_1.PlatformService);
        serviceManager.addSingleton(types_1.IFileSystem, fileSystem_1.FileSystem);
        serviceRegistry_1.registerTypes(serviceManager);
        serviceRegistry_2.registerTypes(serviceManager);
        configService = serviceManager.get(types_3.IConfigurationService);
        pythonExecFactory = serviceContainer.get(types_2.IPythonExecutionFactory);
        yield configService.updateSetting('envFile', undefined, workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        return initialize_1.initializeTest();
    }));
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        cont.unbindAll();
        cont.unload();
        yield initialize_1.closeActiveWindows();
        yield common_1.clearPythonPathInWorkspaceFolder(workspace4Path);
        yield configService.updateSetting('envFile', undefined, workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        yield initialize_1.initializeTest();
    }));
    test('Importing without a valid PYTHONPATH should fail', () => __awaiter(this, void 0, void 0, function* () {
        yield configService.updateSetting('envFile', 'someInvalidFile.env', workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
        pythonExecFactory = serviceContainer.get(types_2.IPythonExecutionFactory);
        const pythonExecService = yield pythonExecFactory.create({ resource: workspace4PyFile });
        const promise = pythonExecService.exec([workspace4PyFile.fsPath], { cwd: path.dirname(workspace4PyFile.fsPath), throwOnStdErr: true });
        yield chai_1.expect(promise).to.eventually.be.rejectedWith(types_2.StdErrError);
    }));
    test('Importing with a valid PYTHONPATH from .env file should succeed', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 2.7 under
            // Windows. Tracked by #2547.
            if (common_1.isOs(platform_1.OSType.Windows) && (yield common_1.isPythonVersion('2.7'))) {
                // tslint:disable-next-line:no-invalid-this
                return this.skip();
            }
            yield configService.updateSetting('envFile', undefined, workspace4PyFile, vscode_1.ConfigurationTarget.WorkspaceFolder);
            const pythonExecService = yield pythonExecFactory.create({ resource: workspace4PyFile });
            const promise = pythonExecService.exec([workspace4PyFile.fsPath], { cwd: path.dirname(workspace4PyFile.fsPath), throwOnStdErr: true });
            yield chai_1.expect(promise).to.eventually.have.property('stdout', `Hello${os_1.EOL}`);
        });
    });
    test('Known modules such as \'os\' and \'sys\' should be deemed \'installed\'', () => __awaiter(this, void 0, void 0, function* () {
        const pythonExecService = yield pythonExecFactory.create({ resource: workspace4PyFile });
        const osModuleIsInstalled = pythonExecService.isModuleInstalled('os');
        const sysModuleIsInstalled = pythonExecService.isModuleInstalled('sys');
        yield chai_1.expect(osModuleIsInstalled).to.eventually.equal(true, 'os module is not installed');
        yield chai_1.expect(sysModuleIsInstalled).to.eventually.equal(true, 'sys module is not installed');
    }));
    test('Unknown modules such as \'xyzabc123\' be deemed \'not installed\'', () => __awaiter(this, void 0, void 0, function* () {
        const pythonExecService = yield pythonExecFactory.create({ resource: workspace4PyFile });
        const randomModuleName = `xyz123${new Date().getSeconds()}`;
        const randomModuleIsInstalled = pythonExecService.isModuleInstalled(randomModuleName);
        yield chai_1.expect(randomModuleIsInstalled).to.eventually.equal(false, `Random module '${randomModuleName}' is installed`);
    }));
    test('Ensure correct path to executable is returned', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = configSettings_1.PythonSettings.getInstance(workspace4Path).pythonPath;
        let expectedExecutablePath;
        if (yield fs.pathExists(pythonPath)) {
            expectedExecutablePath = pythonPath;
        }
        else {
            expectedExecutablePath = yield new Promise(resolve => {
                child_process_1.execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_error, stdout, _stdErr) => {
                    resolve(stdout.trim());
                });
            });
        }
        const pythonExecService = yield pythonExecFactory.create({ resource: workspace4PyFile });
        const executablePath = yield pythonExecService.getExecutablePath();
        chai_1.expect(executablePath).to.equal(expectedExecutablePath, 'Executable paths are not the same');
    }));
});
//# sourceMappingURL=pythonProc.simple.multiroot.test.js.map