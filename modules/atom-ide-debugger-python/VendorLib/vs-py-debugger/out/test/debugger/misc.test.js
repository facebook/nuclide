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
// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any
const path = require("path");
const vscode_debugadapter_testsupport_1 = require("vscode-debugadapter-testsupport");
const constants_1 = require("../../client/common/constants");
const constants_2 = require("../../client/common/platform/constants");
const misc_1 = require("../../client/common/utils/misc");
const constants_3 = require("../../client/debugger/constants");
const types_1 = require("../../client/debugger/types");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const constants_4 = require("./common/constants");
const debugClient_1 = require("./debugClient");
const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');
const EXPERIMENTAL_DEBUG_ADAPTER = path.join(__dirname, '..', '..', 'client', 'debugger', 'debugAdapter', 'main.js');
let testCounter = 0;
const testAdapterFilePath = EXPERIMENTAL_DEBUG_ADAPTER;
const debuggerType = constants_3.DebuggerTypeName;
suite(`Standard Debugging - Misc tests: ${debuggerType}`, () => {
    let debugClient;
    setup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!initialize_1.IS_MULTI_ROOT_TEST || !initialize_1.TEST_DEBUGGER) {
                this.skip();
            }
            yield new Promise(resolve => setTimeout(resolve, 1000));
            debugClient = createDebugAdapter();
            debugClient.defaultTimeout = constants_4.DEBUGGER_TIMEOUT;
            yield debugClient.start();
        });
    });
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        yield common_1.sleep(1000);
        try {
            yield debugClient.stop().catch(misc_1.noop);
            // tslint:disable-next-line:no-empty
        }
        catch (ex) { }
        yield common_1.sleep(1000);
    }));
    /**
     * Creates the debug adapter.
     * We do not need to support code coverage on AppVeyor, lets use the standard test adapter.
     * @returns {DebugClient}
     */
    function createDebugAdapter() {
        if (constants_2.IS_WINDOWS) {
            return new vscode_debugadapter_testsupport_1.DebugClient('node', testAdapterFilePath, debuggerType);
        }
        else {
            const coverageDirectory = path.join(constants_1.EXTENSION_ROOT_DIR, `debug_coverage${testCounter += 1}`);
            return new debugClient_1.DebugClientEx(testAdapterFilePath, debuggerType, coverageDirectory, { cwd: constants_1.EXTENSION_ROOT_DIR });
        }
    }
    function buildLaunchArgs(pythonFile, stopOnEntry = false, showReturnValue = false) {
        const env = { PYTHONPATH: constants_3.PTVSD_PATH };
        // tslint:disable-next-line:no-unnecessary-local-variable
        const options = {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            showReturnValue,
            debugOptions: [types_1.DebugOptions.RedirectOutput],
            pythonPath: common_1.PYTHON_PATH,
            args: [],
            env,
            envFile: '',
            logToFile: false,
            type: debuggerType
        };
        return options;
    }
    test('Should run program to the end', () => __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('simplePrint.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.waitForEvent('terminated')
        ]);
    }));
    test('test stderr output for Python', () => __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('stdErrOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            //TODO: ptvsd does not differentiate.
            debugClient.assertOutput('stderr', 'error output'),
            debugClient.waitForEvent('terminated')
        ]);
    }));
    test('Test stdout output', () => __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs('stdOutOutput.py', false)),
            debugClient.waitForEvent('initialized'),
            debugClient.assertOutput('stdout', 'normal output'),
            debugClient.waitForEvent('terminated')
        ]);
    }));
});
//# sourceMappingURL=misc.test.js.map