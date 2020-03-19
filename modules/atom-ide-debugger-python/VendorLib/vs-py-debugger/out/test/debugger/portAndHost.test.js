"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const getFreePort = require("get-port");
const net = require("net");
const path = require("path");
const vscode_debugadapter_testsupport_1 = require("vscode-debugadapter-testsupport");
const misc_1 = require("../../client/common/utils/misc");
const constants_1 = require("../../client/debugger/constants");
const types_1 = require("../../client/debugger/types");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const constants_2 = require("./common/constants");
chai_1.use(chaiAsPromised);
const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');
const EXPERIMENTAL_DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'debugAdapter', 'main.js');
const testAdapterFilePath = EXPERIMENTAL_DEBUG_ADAPTER;
const debuggerType = constants_1.DebuggerTypeName;
// tslint:disable-next-line:max-func-body-length
suite(`Standard Debugging of ports and hosts: ${debuggerType}`, () => {
    let debugClient;
    setup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!initialize_1.IS_MULTI_ROOT_TEST || !initialize_1.TEST_DEBUGGER) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            yield new Promise(resolve => setTimeout(resolve, 1000));
            debugClient = new vscode_debugadapter_testsupport_1.DebugClient('node', testAdapterFilePath, debuggerType);
            debugClient.defaultTimeout = constants_2.DEBUGGER_TIMEOUT;
            yield debugClient.start();
        });
    });
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        yield new Promise(resolve => setTimeout(resolve, 1000));
        try {
            debugClient.stop().catch(misc_1.noop);
            // tslint:disable-next-line:no-empty
        }
        catch (ex) { }
    }));
    function buildLaunchArgs(pythonFile, stopOnEntry = false, port, host, showReturnValue = false) {
        return {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            showReturnValue,
            logToFile: true,
            debugOptions: [types_1.DebugOptions.RedirectOutput],
            pythonPath: common_1.PYTHON_PATH,
            args: [],
            envFile: '',
            host, port,
            type: debuggerType,
            name: '',
            request: 'launch'
        };
    }
    function testDebuggingWithProvidedPort(port, host) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLaunchArgs('startAndWait.py', false, port, host)),
                debugClient.waitForEvent('initialized')
            ]);
            // Confirm port is in use (if one was provided).
            if (typeof port === 'number' && port > 0) {
                // We know the port 'debuggerPort' was free, now that the debugger has started confirm that this port is no longer free.
                const portBasedOnDebuggerPort = yield getFreePort({ host: 'localhost', port });
                chai_1.expect(portBasedOnDebuggerPort).is.not.equal(port, 'Port assigned to debugger not used by the debugger');
            }
        });
    }
    test('Confirm debuggig works if both port and host are not provided', () => __awaiter(this, void 0, void 0, function* () {
        yield testDebuggingWithProvidedPort();
    }));
    test('Confirm debuggig works if port=0', () => __awaiter(this, void 0, void 0, function* () {
        yield testDebuggingWithProvidedPort(0, 'localhost');
    }));
    test('Confirm debuggig works if port=0 or host=localhost', () => __awaiter(this, void 0, void 0, function* () {
        yield testDebuggingWithProvidedPort(0, 'localhost');
    }));
    test('Confirm debuggig works if port=0 or host=127.0.0.1', () => __awaiter(this, void 0, void 0, function* () {
        yield testDebuggingWithProvidedPort(0, '127.0.0.1');
    }));
    test('Confirm debuggig fails when an invalid host is provided', () => __awaiter(this, void 0, void 0, function* () {
        const promise = testDebuggingWithProvidedPort(0, 'xyz123409924ple_ewf');
        let exception;
        try {
            yield promise;
        }
        catch (ex) {
            exception = ex;
        }
        chai_1.expect(exception.message).contains('ENOTFOUND', 'Debugging failed for some other reason');
    }));
    test('Confirm debuggig fails when provided port is in use', () => __awaiter(this, void 0, void 0, function* () {
        const server = net.createServer(misc_1.noop);
        const port = yield new Promise((resolve, reject) => server.listen({ host: 'localhost', port: 0 }, () => resolve(server.address().port)));
        let exception;
        try {
            yield testDebuggingWithProvidedPort(port);
        }
        catch (ex) {
            exception = ex;
        }
        finally {
            server.close();
        }
        chai_1.expect(exception.message).contains('EADDRINUSE', 'Debugging failed for some other reason');
    }));
});
//# sourceMappingURL=portAndHost.test.js.map