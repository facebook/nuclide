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
// tslint:disable:no-invalid-this no-require-imports no-require-imports no-var-requires
const chai_1 = require("chai");
const path = require("path");
const constants_1 = require("../../client/common/constants");
const misc_1 = require("../../client/common/utils/misc");
const constants_2 = require("../../client/debugger/constants");
const types_1 = require("../../client/debugger/types");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const utils_1 = require("./utils");
const isProcessRunning = require('is-running');
const debugFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'debugging');
const debuggerType = constants_2.DebuggerTypeName;
suite('Run without Debugging', () => {
    let debugClient;
    setup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!initialize_1.IS_MULTI_ROOT_TEST || !initialize_1.TEST_DEBUGGER) {
                this.skip();
            }
            yield new Promise(resolve => setTimeout(resolve, 1000));
            const coverageDirectory = path.join(constants_1.EXTENSION_ROOT_DIR, `debug_coverage_nodebug${this.currentTest.title}`);
            debugClient = yield utils_1.createDebugAdapter(coverageDirectory);
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
    function buildLaunchArgs(pythonFile, stopOnEntry = false, showReturnValue = false) {
        // tslint:disable-next-line:no-unnecessary-local-variable
        return {
            program: path.join(debugFilesPath, pythonFile),
            cwd: debugFilesPath,
            stopOnEntry,
            showReturnValue,
            noDebug: true,
            debugOptions: [types_1.DebugOptions.RedirectOutput],
            pythonPath: common_1.PYTHON_PATH,
            args: [],
            env: { PYTHONPATH: constants_2.PTVSD_PATH },
            envFile: '',
            logToFile: false,
            type: debuggerType,
            name: '',
            request: 'launch'
        };
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
    test('Should kill python process when ending debug session', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const skipped = true;
            if (skipped) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: Why was this skipped?  See gh-2308.
                return this.skip();
            }
            const processIdOutput = new Promise(resolve => {
                debugClient.on('output', (event) => {
                    if (event.event === 'output' && event.body.category === 'stdout') {
                        resolve(parseInt(event.body.output.trim(), 10));
                    }
                });
            });
            yield Promise.all([
                debugClient.configurationSequence(),
                debugClient.launch(buildLaunchArgs('sampleWithSleep.py', false)),
                debugClient.waitForEvent('initialized'),
                processIdOutput
            ]);
            const processId = yield processIdOutput;
            chai_1.expect(processId).to.be.greaterThan(0, 'Invalid process id');
            yield debugClient.stop();
            yield common_1.sleep(1000);
            // Confirm the process is dead
            chai_1.expect(isProcessRunning(processId)).to.be.equal(false, 'Python program is still alive');
        });
    });
});
//# sourceMappingURL=run.test.js.map