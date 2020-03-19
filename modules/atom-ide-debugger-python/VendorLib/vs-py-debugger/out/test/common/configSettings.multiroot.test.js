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
const vscode_1 = require("vscode");
const configSettings_1 = require("../../client/common/configSettings");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');
// tslint:disable-next-line:max-func-body-length
suite('Multiroot Config Settings', () => {
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!initialize_1.IS_MULTI_ROOT_TEST) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            yield common_1.clearPythonPathInWorkspaceFolder(vscode_1.Uri.file(path.join(multirootPath, 'workspace1')));
            yield initialize_1.initialize();
        });
    });
    setup(initialize_1.initializeTest);
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.closeActiveWindows();
        yield common_1.clearPythonPathInWorkspaceFolder(vscode_1.Uri.file(path.join(multirootPath, 'workspace1')));
        yield initialize_1.initializeTest();
    }));
    function enableDisableLinterSetting(resource, configTarget, setting, enabled) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = vscode_1.workspace.getConfiguration('python.linting', resource);
            const cfgValue = settings.inspect(setting);
            if (configTarget === vscode_1.ConfigurationTarget.Workspace && cfgValue && cfgValue.workspaceValue === enabled) {
                return;
            }
            if (configTarget === vscode_1.ConfigurationTarget.WorkspaceFolder && cfgValue && cfgValue.workspaceFolderValue === enabled) {
                return;
            }
            yield settings.update(setting, enabled, configTarget);
            configSettings_1.PythonSettings.dispose();
        });
    }
    test('Workspace folder should inherit Python Path from workspace root', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'workspace1'));
        let settings = vscode_1.workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        yield settings.update('pythonPath', pythonPath, vscode_1.ConfigurationTarget.Workspace);
        const value = settings.inspect('pythonPath');
        if (value && typeof value.workspaceFolderValue === 'string') {
            yield settings.update('pythonPath', undefined, vscode_1.ConfigurationTarget.WorkspaceFolder);
        }
        settings = vscode_1.workspace.getConfiguration('python', workspaceUri);
        configSettings_1.PythonSettings.dispose();
        const cfgSetting = configSettings_1.PythonSettings.getInstance(workspaceUri);
        assert.equal(cfgSetting.pythonPath, pythonPath, 'Python Path not inherited from workspace');
    }));
    test('Workspace folder should not inherit Python Path from workspace root', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'workspace1'));
        const settings = vscode_1.workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        yield settings.update('pythonPath', pythonPath, vscode_1.ConfigurationTarget.Workspace);
        const privatePythonPath = `x${new Date().getTime()}`;
        yield settings.update('pythonPath', privatePythonPath, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const cfgSetting = configSettings_1.PythonSettings.getInstance(workspaceUri);
        assert.equal(cfgSetting.pythonPath, privatePythonPath, 'Python Path for workspace folder is incorrect');
    }));
    test('Workspace folder should inherit Python Path from workspace root when opening a document', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');
        const settings = vscode_1.workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        yield settings.update('pythonPath', pythonPath, vscode_1.ConfigurationTarget.Workspace);
        // Update workspace folder to something else so it gets refreshed.
        yield settings.update('pythonPath', `x${new Date().getTime()}`, vscode_1.ConfigurationTarget.WorkspaceFolder);
        yield settings.update('pythonPath', undefined, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const document = yield vscode_1.workspace.openTextDocument(fileToOpen);
        const cfg = configSettings_1.PythonSettings.getInstance(document.uri);
        assert.equal(cfg.pythonPath, pythonPath, 'Python Path not inherited from workspace');
    }));
    test('Workspace folder should not inherit Python Path from workspace root when opening a document', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');
        const settings = vscode_1.workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        yield settings.update('pythonPath', pythonPath, vscode_1.ConfigurationTarget.Workspace);
        const privatePythonPath = `x${new Date().getTime()}`;
        yield settings.update('pythonPath', privatePythonPath, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const document = yield vscode_1.workspace.openTextDocument(fileToOpen);
        const cfg = configSettings_1.PythonSettings.getInstance(document.uri);
        assert.equal(cfg.pythonPath, privatePythonPath, 'Python Path for workspace folder is incorrect');
    }));
    test('Enabling/Disabling Pylint in root should be reflected in config settings', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'workspace1'));
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', undefined);
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.Workspace, 'pylintEnabled', true);
        let settings = configSettings_1.PythonSettings.getInstance(workspaceUri);
        assert.equal(settings.linting.pylintEnabled, true, 'Pylint not enabled when it should be');
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.Workspace, 'pylintEnabled', false);
        settings = configSettings_1.PythonSettings.getInstance(workspaceUri);
        assert.equal(settings.linting.pylintEnabled, false, 'Pylint enabled when it should not be');
    }));
    test('Enabling/Disabling Pylint in root and workspace should be reflected in config settings', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'workspace1'));
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.Workspace, 'pylintEnabled', true);
        let cfgSetting = configSettings_1.PythonSettings.getInstance(workspaceUri);
        assert.equal(cfgSetting.linting.pylintEnabled, false, 'Workspace folder pylint setting is true when it should not be');
        configSettings_1.PythonSettings.dispose();
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.Workspace, 'pylintEnabled', false);
        cfgSetting = configSettings_1.PythonSettings.getInstance(workspaceUri);
        assert.equal(cfgSetting.linting.pylintEnabled, true, 'Workspace folder pylint setting is false when it should not be');
    }));
    test('Enabling/Disabling Pylint in root should be reflected in config settings when opening a document', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.Workspace, 'pylintEnabled', false);
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        let document = yield vscode_1.workspace.openTextDocument(fileToOpen);
        let cfg = configSettings_1.PythonSettings.getInstance(document.uri);
        assert.equal(cfg.linting.pylintEnabled, true, 'Pylint should be enabled in workspace');
        configSettings_1.PythonSettings.dispose();
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.Workspace, 'pylintEnabled', true);
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        document = yield vscode_1.workspace.openTextDocument(fileToOpen);
        cfg = configSettings_1.PythonSettings.getInstance(document.uri);
        assert.equal(cfg.linting.pylintEnabled, false, 'Pylint should not be enabled in workspace');
    }));
    test('Enabling/Disabling Pylint in root should be reflected in config settings when opening a document', () => __awaiter(this, void 0, void 0, function* () {
        const workspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.Workspace, 'pylintEnabled', false);
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        let document = yield vscode_1.workspace.openTextDocument(fileToOpen);
        let cfg = configSettings_1.PythonSettings.getInstance(document.uri);
        assert.equal(cfg.linting.pylintEnabled, true, 'Pylint should be enabled in workspace');
        configSettings_1.PythonSettings.dispose();
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.Workspace, 'pylintEnabled', true);
        yield enableDisableLinterSetting(workspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        document = yield vscode_1.workspace.openTextDocument(fileToOpen);
        cfg = configSettings_1.PythonSettings.getInstance(document.uri);
        assert.equal(cfg.linting.pylintEnabled, false, 'Pylint should not be enabled in workspace');
    }));
    // tslint:disable-next-line:no-invalid-template-strings
    test('${workspaceFolder} variable in settings should be replaced with the right value', () => __awaiter(this, void 0, void 0, function* () {
        const workspace2Uri = vscode_1.Uri.file(path.join(multirootPath, 'workspace2'));
        let fileToOpen = path.join(workspace2Uri.fsPath, 'file.py');
        let document = yield vscode_1.workspace.openTextDocument(fileToOpen);
        let cfg = configSettings_1.PythonSettings.getInstance(document.uri);
        assert.equal(path.dirname(cfg.workspaceSymbols.tagFilePath), workspace2Uri.fsPath, 'ctags file path for workspace2 is incorrect');
        assert.equal(path.basename(cfg.workspaceSymbols.tagFilePath), 'workspace2.tags.file', 'ctags file name for workspace2 is incorrect');
        configSettings_1.PythonSettings.dispose();
        const workspace3Uri = vscode_1.Uri.file(path.join(multirootPath, 'workspace3'));
        fileToOpen = path.join(workspace3Uri.fsPath, 'file.py');
        document = yield vscode_1.workspace.openTextDocument(fileToOpen);
        cfg = configSettings_1.PythonSettings.getInstance(document.uri);
        assert.equal(path.dirname(cfg.workspaceSymbols.tagFilePath), workspace3Uri.fsPath, 'ctags file path for workspace3 is incorrect');
        assert.equal(path.basename(cfg.workspaceSymbols.tagFilePath), 'workspace3.tags.file', 'ctags file name for workspace3 is incorrect');
        configSettings_1.PythonSettings.dispose();
    }));
});
//# sourceMappingURL=configSettings.multiroot.test.js.map