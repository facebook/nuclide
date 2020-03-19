"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const path = require("path");
const vscode = require("vscode");
const configSettings_1 = require("../../client/common/configSettings");
const constants_1 = require("../../client/common/platform/constants");
const systemVariables_1 = require("../../client/common/variables/systemVariables");
const initialize_1 = require("./../initialize");
const workspaceRoot = path.join(__dirname, '..', '..', '..', 'src', 'test');
// Defines a Mocha test suite to group tests of similar kind together
suite('Configuration Settings', () => {
    setup(initialize_1.initialize);
    test('Check Values', done => {
        const systemVariables = new systemVariables_1.SystemVariables(workspaceRoot);
        // tslint:disable-next-line:no-any
        const pythonConfig = vscode.workspace.getConfiguration('python', null);
        const pythonSettings = configSettings_1.PythonSettings.getInstance(vscode.Uri.file(workspaceRoot));
        Object.keys(pythonSettings).forEach(key => {
            let settingValue = pythonConfig.get(key, 'Not a config');
            if (settingValue === 'Not a config') {
                return;
            }
            if (settingValue) {
                settingValue = systemVariables.resolve(settingValue);
            }
            // tslint:disable-next-line:no-any
            const pythonSettingValue = pythonSettings[key];
            if (key.endsWith('Path') && constants_1.IS_WINDOWS) {
                assert.equal(settingValue.toUpperCase(), pythonSettingValue.toUpperCase(), `Setting ${key} not the same`);
            }
            else if (key === 'workspaceSymbols' && constants_1.IS_WINDOWS) {
                const workspaceSettings = pythonSettingValue;
                const workspaceSttings = settingValue;
                assert.equal(workspaceSettings.tagFilePath.toUpperCase(), workspaceSttings.tagFilePath.toUpperCase(), `Setting ${key} not the same`);
                const workspaceSettingsWithoutPath = Object.assign({}, workspaceSettings);
                delete workspaceSettingsWithoutPath.tagFilePath;
                const pythonSettingValueWithoutPath = Object.assign({}, pythonSettingValue);
                delete pythonSettingValueWithoutPath.tagFilePath;
                assert.deepEqual(workspaceSettingsWithoutPath, pythonSettingValueWithoutPath, `Setting ${key} not the same`);
            }
        });
        done();
    });
});
//# sourceMappingURL=configSettings.test.js.map