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
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const pythonPathUpdaterServiceFactory_1 = require("../../client/interpreter/configuration/pythonPathUpdaterServiceFactory");
// tslint:disable:no-invalid-template-strings max-func-body-length
suite('Python Path Settings Updater', () => {
    let serviceContainer;
    let workspaceService;
    let updaterServiceFactory;
    function setupMocks() {
        serviceContainer = TypeMoq.Mock.ofType();
        workspaceService = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService))).returns(() => workspaceService.object);
        updaterServiceFactory = new pythonPathUpdaterServiceFactory_1.PythonPathUpdaterServiceFactory(serviceContainer.object);
    }
    function setupConfigProvider(resource) {
        const workspaceConfig = TypeMoq.Mock.ofType();
        workspaceService.setup(w => w.getConfiguration(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(resource))).returns(() => workspaceConfig.object);
        return workspaceConfig;
    }
    suite('Global', () => {
        setup(setupMocks);
        test('Python Path should not be updated when current pythonPath is the same', () => __awaiter(this, void 0, void 0, function* () {
            const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
            const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider();
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => {
                // tslint:disable-next-line:no-any
                return { globalValue: pythonPath };
            });
            yield updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(w => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
        }));
        test('Python Path should be updated when current pythonPath is different', () => __awaiter(this, void 0, void 0, function* () {
            const updater = updaterServiceFactory.getGlobalPythonPathConfigurationService();
            const pythonPath = `xGlobalPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider();
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);
            yield updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(w => w.update(TypeMoq.It.isValue('pythonPath'), TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(true)), TypeMoq.Times.once());
        }));
    });
    suite('WorkspaceFolder', () => {
        setup(setupMocks);
        test('Python Path should not be updated when current pythonPath is the same', () => __awaiter(this, void 0, void 0, function* () {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = vscode_1.Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
            const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => {
                // tslint:disable-next-line:no-any
                return { workspaceFolderValue: pythonPath };
            });
            yield updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(w => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
        }));
        test('Python Path should be updated when current pythonPath is different', () => __awaiter(this, void 0, void 0, function* () {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = vscode_1.Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
            const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);
            yield updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(w => w.update(TypeMoq.It.isValue('pythonPath'), TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(vscode_1.ConfigurationTarget.WorkspaceFolder)), TypeMoq.Times.once());
        }));
        test('Python Path should be truncated for worspace-relative paths', () => __awaiter(this, void 0, void 0, function* () {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = vscode_1.Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspaceFolderPythonPathConfigurationService(workspaceFolder);
            const pythonPath = vscode_1.Uri.file(path.join(workspaceFolderPath, 'env', 'bin', 'python')).fsPath;
            const expectedPythonPath = path.join('env', 'bin', 'python');
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);
            yield updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(w => w.update(TypeMoq.It.isValue('pythonPath'), TypeMoq.It.isValue(expectedPythonPath), TypeMoq.It.isValue(vscode_1.ConfigurationTarget.WorkspaceFolder)), TypeMoq.Times.once());
        }));
    });
    suite('Workspace (multiroot scenario)', () => {
        setup(setupMocks);
        test('Python Path should not be updated when current pythonPath is the same', () => __awaiter(this, void 0, void 0, function* () {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = vscode_1.Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
            const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => {
                // tslint:disable-next-line:no-any
                return { workspaceValue: pythonPath };
            });
            yield updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(w => w.update(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
        }));
        test('Python Path should be updated when current pythonPath is different', () => __awaiter(this, void 0, void 0, function* () {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = vscode_1.Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
            const pythonPath = `xWorkspaceFolderPythonPath${new Date().getMilliseconds()}`;
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);
            yield updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(w => w.update(TypeMoq.It.isValue('pythonPath'), TypeMoq.It.isValue(pythonPath), TypeMoq.It.isValue(false)), TypeMoq.Times.once());
        }));
        test('Python Path should be truncated for workspace-relative paths', () => __awaiter(this, void 0, void 0, function* () {
            const workspaceFolderPath = path.join('user', 'desktop', 'development');
            const workspaceFolder = vscode_1.Uri.file(workspaceFolderPath);
            const updater = updaterServiceFactory.getWorkspacePythonPathConfigurationService(workspaceFolder);
            const pythonPath = vscode_1.Uri.file(path.join(workspaceFolderPath, 'env', 'bin', 'python')).fsPath;
            const expectedPythonPath = path.join('env', 'bin', 'python');
            const workspaceConfig = setupConfigProvider(workspaceFolder);
            workspaceConfig.setup(w => w.inspect(TypeMoq.It.isValue('pythonPath'))).returns(() => undefined);
            yield updater.updatePythonPath(pythonPath);
            workspaceConfig.verify(w => w.update(TypeMoq.It.isValue('pythonPath'), TypeMoq.It.isValue(expectedPythonPath), TypeMoq.It.isValue(false)), TypeMoq.Times.once());
        }));
    });
});
//# sourceMappingURL=pythonPathUpdater.test.js.map