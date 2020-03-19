"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
Object.defineProperty(exports, "__esModule", { value: true });
const nodeChildProcess = require("child_process");
const Q = require("q");
const errorHelper_1 = require("../error/errorHelper");
const internalErrorCode_1 = require("../error/internalErrorCode");
class ChildProcess {
    constructor({ childProcess = nodeChildProcess } = {}) {
        this.childProcess = childProcess;
    }
    exec(command, options = {}) {
        let outcome = Q.defer();
        let execProcess = this.childProcess.exec(command, options, (error, stdout, stderr) => {
            if (error) {
                outcome.reject(errorHelper_1.ErrorHelper.getNestedError(error, internalErrorCode_1.InternalErrorCode.CommandFailed, command));
            }
            else {
                outcome.resolve(stdout);
            }
        });
        return { process: execProcess, outcome: outcome.promise };
    }
    execToString(command, options = {}) {
        return this.exec(command, options).outcome.then(stdout => stdout.toString());
    }
    spawn(command, args = [], options = {}) {
        const startup = Q.defer();
        const outcome = Q.defer();
        const spawnedProcess = this.childProcess.spawn(command, args, options);
        spawnedProcess.once("error", (error) => {
            startup.reject(error);
            outcome.reject(error);
        });
        Q.delay(ChildProcess.ERROR_TIMEOUT_MILLISECONDS).done(() => startup.resolve(void 0));
        startup.promise.done(() => { }, () => { }); // Most callers don't use startup, and Q prints a warning if we don't attach any .done()
        spawnedProcess.once("exit", (code) => {
            if (code === 0) {
                outcome.resolve(void 0);
            }
            else {
                const commandWithArgs = command + " " + args.join(" ");
                outcome.reject(errorHelper_1.ErrorHelper.getInternalError(internalErrorCode_1.InternalErrorCode.CommandFailed, commandWithArgs, code));
            }
        });
        return {
            spawnedProcess: spawnedProcess,
            stdin: spawnedProcess.stdin,
            stdout: spawnedProcess.stdout,
            stderr: spawnedProcess.stderr,
            startup: startup.promise,
            outcome: outcome.promise,
        };
    }
}
ChildProcess.ERROR_TIMEOUT_MILLISECONDS = 300;
exports.ChildProcess = ChildProcess;

//# sourceMappingURL=childProcess.js.map
