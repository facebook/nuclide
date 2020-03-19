"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const path = require("path");
const ts = require("vscode-chrome-debug-core-testsupport");
const NIGHTLY_NAME = os.platform() === 'win32' ? 'node-nightly.cmd' : 'node-nightly';
function patchLaunchArgs(launchArgs) {
    launchArgs.trace = 'verbose';
    if (process.version.startsWith('v6.2')) {
        launchArgs.runtimeExecutable = NIGHTLY_NAME;
    }
    if (!launchArgs.port) {
        launchArgs.port = 9229;
        launchArgs.runtimeArgs = launchArgs.runtimeArgs || [];
        launchArgs.runtimeArgs.push(`--inspect=${launchArgs.port}`, '--debug-brk');
    }
}
function setup(port) {
    return ts.setup('./out/src/nodeDebug.js', 'node2', patchLaunchArgs, port);
}
exports.setup = setup;
function teardown() {
    ts.teardown();
}
exports.teardown = teardown;
exports.lowercaseDriveLetterDirname = __dirname.charAt(0).toLowerCase() + __dirname.substr(1);
exports.PROJECT_ROOT = path.join(exports.lowercaseDriveLetterDirname, '../../');
exports.DATA_ROOT = path.join(exports.PROJECT_ROOT, 'testdata/');

//# sourceMappingURL=testSetup.js.map
