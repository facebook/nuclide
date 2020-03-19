"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const currentProcess_1 = require("../../../client/common/process/currentProcess");
suite('Current Process', () => {
    let currentProcess;
    setup(() => {
        currentProcess = new currentProcess_1.CurrentProcess();
    });
    test('Current process argv is returned', () => {
        chai_1.expect(currentProcess.argv).to.deep.equal(process.argv);
    });
    test('Current process env is returned', () => {
        chai_1.expect(currentProcess.env).to.deep.equal(process.env);
    });
    test('Current process stdin is returned', () => {
        chai_1.expect(currentProcess.stdin).to.deep.equal(process.stdin);
    });
    test('Current process stdout is returned', () => {
        chai_1.expect(currentProcess.stdout).to.deep.equal(process.stdout);
    });
});
//# sourceMappingURL=currentProcess.test.js.map