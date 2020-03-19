// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
//
// Constants that pertain to CI processes/tests only. No dependencies on vscode!
//
exports.IS_APPVEYOR = process.env.APPVEYOR === 'true';
exports.IS_TRAVIS = process.env.TRAVIS === 'true';
exports.IS_VSTS = process.env.TF_BUILD !== undefined;
exports.IS_CI_SERVER = exports.IS_TRAVIS || exports.IS_APPVEYOR || exports.IS_VSTS;
// Control JUnit-style output logging for reporting purposes.
let reportJunit = false;
if (exports.IS_CI_SERVER && process.env.MOCHA_REPORTER_JUNIT !== undefined) {
    reportJunit = process.env.MOCHA_REPORTER_JUNIT.toLowerCase() === 'true';
}
exports.MOCHA_REPORTER_JUNIT = reportJunit;
exports.MOCHA_CI_REPORTFILE = exports.MOCHA_REPORTER_JUNIT && process.env.MOCHA_CI_REPORTFILE !== undefined ?
    process.env.MOCHA_CI_REPORTFILE : './junit-out.xml';
exports.MOCHA_CI_PROPERTIES = exports.MOCHA_REPORTER_JUNIT && process.env.MOCHA_CI_PROPERTIES !== undefined ?
    process.env.MOCHA_CI_PROPERTIES : '';
exports.MOCHA_CI_REPORTER_ID = exports.MOCHA_REPORTER_JUNIT && process.env.MOCHA_CI_REPORTER_ID !== undefined ?
    process.env.MOCHA_CI_REPORTER_ID : 'mocha-junit-reporter';
exports.IS_CI_SERVER_TEST_DEBUGGER = process.env.IS_CI_SERVER_TEST_DEBUGGER === '1';
//# sourceMappingURL=ciConstants.js.map