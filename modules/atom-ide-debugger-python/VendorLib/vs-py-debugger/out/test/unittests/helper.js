"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const path_1 = require("path");
const constants_1 = require("../../client/common/platform/constants");
function lookForTestFile(tests, testFile) {
    let found;
    // Perform case insensitive search on windows.
    if (constants_1.IS_WINDOWS) {
        // In the mock output, we'd have paths separated using '/' (but on windows, path separators are '\')
        const testFileToSearch = testFile.split(path_1.sep).join('/');
        found = tests.testFiles.some(t => (t.name.toUpperCase() === testFile.toUpperCase() || t.name.toUpperCase() === testFileToSearch.toUpperCase()) &&
            t.nameToRun.toUpperCase() === t.name.toUpperCase());
    }
    else {
        found = tests.testFiles.some(t => t.name === testFile && t.nameToRun === t.name);
    }
    assert.equal(found, true, `Test File not found '${testFile}'`);
}
exports.lookForTestFile = lookForTestFile;
//# sourceMappingURL=helper.js.map