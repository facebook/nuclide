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
// tslint:disable:no-any no-http-string
const chai_1 = require("chai");
const path = require("path");
const request = require("request");
const vscode_debugadapter_testsupport_1 = require("vscode-debugadapter-testsupport");
const constants_1 = require("../../client/common/constants");
const constants_2 = require("../../client/common/platform/constants");
const constants_3 = require("../../client/debugger/constants");
const constants_4 = require("./common/constants");
const debugClient_1 = require("./debugClient");
const testAdapterFilePath = path.join(constants_1.EXTENSION_ROOT_DIR, 'out', 'client', 'debugger', 'debugAdapter', 'main.js');
const debuggerType = constants_3.DebuggerTypeName;
/**
 * Creates the debug adapter.
 * We do not need to support code coverage on AppVeyor, lets use the standard test adapter.
 * @returns {DebugClient}
 */
function createDebugAdapter(coverageDirectory) {
    return __awaiter(this, void 0, void 0, function* () {
        yield new Promise(resolve => setTimeout(resolve, 1000));
        let debugClient;
        if (constants_2.IS_WINDOWS) {
            debugClient = new vscode_debugadapter_testsupport_1.DebugClient('node', testAdapterFilePath, debuggerType);
        }
        else {
            debugClient = new debugClient_1.DebugClientEx(testAdapterFilePath, debuggerType, coverageDirectory, { cwd: constants_1.EXTENSION_ROOT_DIR });
        }
        debugClient.defaultTimeout = constants_4.DEBUGGER_TIMEOUT;
        yield debugClient.start();
        return debugClient;
    });
}
exports.createDebugAdapter = createDebugAdapter;
function continueDebugging(debugClient) {
    return __awaiter(this, void 0, void 0, function* () {
        const threads = yield debugClient.threadsRequest();
        chai_1.expect(threads).to.be.not.equal(undefined, 'no threads response');
        chai_1.expect(threads.body.threads).to.be.lengthOf(1);
        yield debugClient.continueRequest({ threadId: threads.body.threads[0].id });
    });
}
exports.continueDebugging = continueDebugging;
function validateVariablesInFrame(debugClient, stackTrace, expectedVariables, numberOfScopes) {
    return __awaiter(this, void 0, void 0, function* () {
        const frameId = stackTrace.body.stackFrames[0].id;
        const scopes = yield debugClient.scopesRequest({ frameId });
        if (numberOfScopes) {
            chai_1.expect(scopes.body.scopes).of.length(1, 'Incorrect number of scopes');
        }
        const variablesReference = scopes.body.scopes[0].variablesReference;
        const variables = yield debugClient.variablesRequest({ variablesReference });
        for (const expectedVariable of expectedVariables) {
            const variable = variables.body.variables.find(item => item.name === expectedVariable.name);
            chai_1.expect(variable).to.be.not.equal('undefined', `variable '${expectedVariable.name}' is undefined`);
            chai_1.expect(variable.type).to.be.equal(expectedVariable.type);
            chai_1.expect(variable.value).to.be.equal(expectedVariable.value);
        }
    });
}
exports.validateVariablesInFrame = validateVariablesInFrame;
function makeHttpRequest(uri) {
    return new Promise((resolve, reject) => {
        request.get(uri, (error, response, body) => {
            if (error) {
                return reject(error);
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Status code = ${response.statusCode}`));
            }
            else {
                resolve(body.toString());
            }
        });
    });
}
exports.makeHttpRequest = makeHttpRequest;
function hitHttpBreakpoint(debugClient, uri, file, line) {
    return __awaiter(this, void 0, void 0, function* () {
        const breakpointLocation = { path: file, column: 1, line };
        yield debugClient.setBreakpointsRequest({
            lines: [breakpointLocation.line],
            breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
            source: { path: breakpointLocation.path }
        });
        // Make the request, we want the breakpoint to be hit.
        const breakpointPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
        const httpResult = makeHttpRequest(uri);
        return [yield breakpointPromise, httpResult];
    });
}
exports.hitHttpBreakpoint = hitHttpBreakpoint;
//# sourceMappingURL=utils.js.map