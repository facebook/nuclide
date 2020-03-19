"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const path = require("path");
const constants_1 = require("../../client/common/constants");
const launcherProvider_1 = require("../../client/debugger/debugAdapter/DebugClients/launcherProvider");
suite('Debugger - Launcher Script Provider', () => {
    test('Ensure debugger gets the launcher from PythonTools directory', () => {
        const launcherPath = new launcherProvider_1.DebuggerLauncherScriptProvider().getLauncherFilePath();
        const expectedPath = path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
        chai_1.expect(launcherPath).to.be.equal(expectedPath);
    });
    test('Ensure debugger gets the non debug launcher from PythonTools directory', () => {
        const launcherPath = new launcherProvider_1.NoDebugLauncherScriptProvider().getLauncherFilePath();
        const expectedPath = path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'experimental', 'ptvsd_launcher.py');
        chai_1.expect(launcherPath).to.be.equal(expectedPath);
    });
});
//# sourceMappingURL=launcherScriptProvider.unit.test.js.map