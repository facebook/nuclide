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
// tslint:disable:no-any max-func-body-length no-invalid-this max-classes-per-file
const chai_1 = require("chai");
const child_process_1 = require("child_process");
const proc_1 = require("../../../client/common/process/proc");
const async_1 = require("../../../client/common/utils/async");
const common_1 = require("../../common");
suite('Process - Process Service', function () {
    // tslint:disable-next-line:no-invalid-this
    this.timeout(5000);
    let procIdsToKill = [];
    teardown(() => {
        // tslint:disable-next-line:no-require-imports
        const killProcessTree = require('tree-kill');
        procIdsToKill.forEach(pid => {
            try {
                killProcessTree(pid);
            }
            catch (_a) {
                // Ignore.
            }
        });
        procIdsToKill = [];
    });
    function spawnProc() {
        const proc = child_process_1.spawn(common_1.PYTHON_PATH, ['-c', 'while(True): import time;time.sleep(0.5);print(1)']);
        const exited = async_1.createDeferred();
        proc.on('exit', () => exited.resolve(true));
        procIdsToKill.push(proc.pid);
        return { pid: proc.pid, exited: exited.promise };
    }
    test('Process is killed', () => __awaiter(this, void 0, void 0, function* () {
        const proc = spawnProc();
        proc_1.ProcessService.kill(proc.pid);
        chai_1.expect(yield proc.exited).to.equal(true, 'process did not die');
    }));
    test('Process is alive', () => __awaiter(this, void 0, void 0, function* () {
        const proc = spawnProc();
        chai_1.expect(proc_1.ProcessService.isAlive(proc.pid)).to.equal(true, 'process is not alive');
    }));
});
//# sourceMappingURL=proc.unit.test.js.map