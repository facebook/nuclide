"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
function normalizeMarkedString(content) {
    return typeof content === 'string' ? content : content.value;
}
exports.normalizeMarkedString = normalizeMarkedString;
function compareFiles(expectedContent, actualContent) {
    const expectedLines = expectedContent.split(/\r?\n/);
    const actualLines = actualContent.split(/\r?\n/);
    for (let i = 0; i < Math.min(expectedLines.length, actualLines.length); i += 1) {
        const e = expectedLines[i];
        const a = actualLines[i];
        chai_1.expect(e, `Difference at line ${i}`).to.be.equal(a);
    }
    chai_1.expect(actualLines.length, expectedLines.length > actualLines.length
        ? 'Actual contains more lines than expected'
        : 'Expected contains more lines than the actual').to.be.equal(expectedLines.length);
}
exports.compareFiles = compareFiles;
//# sourceMappingURL=textUtils.js.map