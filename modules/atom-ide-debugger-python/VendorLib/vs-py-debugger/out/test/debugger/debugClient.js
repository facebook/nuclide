// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path = require("path");
const vscode_debugadapter_testsupport_1 = require("vscode-debugadapter-testsupport");
const constants_1 = require("../../client/common/constants");
const misc_1 = require("../../client/common/utils/misc");
class DebugClientEx extends vscode_debugadapter_testsupport_1.DebugClient {
    constructor(executable, debugType, coverageDirectory, spawnOptions) {
        super('node', '', debugType, spawnOptions);
        this.executable = executable;
        this.coverageDirectory = coverageDirectory;
        this.spawnOptions = spawnOptions;
        this.stopAdapterProcess = () => {
            if (this.adapterProcess) {
                this.adapterProcess.kill();
                this.adapterProcess = undefined;
            }
        };
    }
    /**
     * Starts a new debug adapter and sets up communication via stdin/stdout.
     * If a port number is specified the adapter is not launched but a connection to
     * a debug adapter running in server mode is established. This is useful for debugging
     * the adapter while running tests. For this reason all timeouts are disabled in server mode.
     */
    start(port) {
        return new Promise((resolve, reject) => {
            const runtime = path.join(constants_1.EXTENSION_ROOT_DIR, 'node_modules', '.bin', 'istanbul');
            const args = ['cover', '--report=json', '--print=none', `--dir=${this.coverageDirectory}`, '--handle-sigint', this.executable];
            this.adapterProcess = child_process_1.spawn(runtime, args, this.spawnOptions);
            this.adapterProcess.stderr.on('data', misc_1.noop);
            this.adapterProcess.on('error', (err) => {
                console.error(err);
                reject(err);
            });
            this.adapterProcess.on('exit', misc_1.noop);
            this.connect(this.adapterProcess.stdout, this.adapterProcess.stdin);
            resolve();
        });
    }
    stop() {
        return this.disconnectRequest().then(this.stopAdapterProcess).catch(this.stopAdapterProcess);
    }
}
exports.DebugClientEx = DebugClientEx;
//# sourceMappingURL=debugClient.js.map