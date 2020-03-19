"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const vscode_1 = require("vscode");
const configSettings_1 = require("../common/configSettings");
class ConfigSettingMonitor extends events_1.EventEmitter {
    constructor(settingToMonitor) {
        super();
        this.settingToMonitor = settingToMonitor;
        this.oldSettings = new Map();
        this.initializeSettings();
        // tslint:disable-next-line:no-void-expression
        configSettings_1.PythonSettings.getInstance().on('change', () => this.onConfigChange());
    }
    dispose() {
        if (this.timeout) {
            // tslint:disable-next-line:no-unsafe-any
            clearTimeout(this.timeout);
        }
    }
    onConfigChange() {
        if (this.timeout) {
            // tslint:disable-next-line:no-unsafe-any
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => {
            this.timeout = undefined;
            this.checkChangesToSettingsInWorkspace();
            this.checkChangesToSettingsInWorkspaceFolders();
        }, 1000);
    }
    initializeSettings() {
        if (!Array.isArray(vscode_1.workspace.workspaceFolders)) {
            return;
        }
        if (vscode_1.workspace.workspaceFolders.length === 1) {
            const key = this.getWorkspaceKey();
            const currentValue = JSON.stringify(configSettings_1.PythonSettings.getInstance()[this.settingToMonitor]);
            this.oldSettings.set(key, currentValue);
        }
        else {
            vscode_1.workspace.workspaceFolders.forEach(wkspaceFolder => {
                const key = this.getWorkspaceFolderKey(wkspaceFolder.uri);
                const currentValue = JSON.stringify(configSettings_1.PythonSettings.getInstance(wkspaceFolder.uri)[this.settingToMonitor]);
                this.oldSettings.set(key, currentValue);
            });
        }
    }
    checkChangesToSettingsInWorkspace() {
        if (!Array.isArray(vscode_1.workspace.workspaceFolders) || vscode_1.workspace.workspaceFolders.length === 0) {
            return;
        }
        const newValue = JSON.stringify(configSettings_1.PythonSettings.getInstance()[this.settingToMonitor]);
        this.checkChangesAndNotifiy(vscode_1.ConfigurationTarget.Workspace, vscode_1.workspace.workspaceFolders[0].uri, newValue);
    }
    checkChangesToSettingsInWorkspaceFolders() {
        if (!Array.isArray(vscode_1.workspace.workspaceFolders) || vscode_1.workspace.workspaceFolders.length <= 1) {
            return;
        }
        // tslint:disable-next-line:no-void-expression
        vscode_1.workspace.workspaceFolders.forEach(folder => this.checkChangesToSettingsInWorkspaceFolder(folder));
    }
    checkChangesToSettingsInWorkspaceFolder(workspaceFolder) {
        const newValue = JSON.stringify(configSettings_1.PythonSettings.getInstance(workspaceFolder.uri)[this.settingToMonitor]);
        this.checkChangesAndNotifiy(vscode_1.ConfigurationTarget.WorkspaceFolder, workspaceFolder.uri, newValue);
    }
    checkChangesAndNotifiy(configTarget, uri, newValue) {
        const key = configTarget === vscode_1.ConfigurationTarget.Workspace ? this.getWorkspaceKey() : this.getWorkspaceFolderKey(uri);
        if (this.oldSettings.has(key)) {
            const oldValue = this.oldSettings.get(key);
            if (oldValue !== newValue) {
                this.oldSettings.set(key, newValue);
                this.emit('change', configTarget, uri);
            }
        }
        else {
            this.oldSettings.set(key, newValue);
        }
    }
    getWorkspaceKey() {
        // tslint:disable-next-line:no-non-null-assertion
        return vscode_1.workspace.workspaceFolders[0].uri.fsPath;
    }
    getWorkspaceFolderKey(wkspaceFolder) {
        return `${vscode_1.ConfigurationTarget.WorkspaceFolder}:${wkspaceFolder.fsPath}`;
    }
}
exports.ConfigSettingMonitor = ConfigSettingMonitor;
//# sourceMappingURL=configSettingMonitor.js.map