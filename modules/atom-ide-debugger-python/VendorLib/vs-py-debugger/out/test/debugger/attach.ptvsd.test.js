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
require("../../client/common/extensions");
const child_process_1 = require("child_process");
const getFreePort = require("get-port");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const constants_1 = require("../../client/common/constants");
const types_1 = require("../../client/common/platform/types");
const util_1 = require("../../client/common/util");
const constants_2 = require("../../client/debugger/constants");
const pythonV2Provider_1 = require("../../client/debugger/extension/configProviders/pythonV2Provider");
const types_2 = require("../../client/debugger/types");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const utils_1 = require("./utils");
// tslint:disable:no-invalid-this max-func-body-length no-empty no-increment-decrement no-unused-variable no-console
const fileToDebug = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger-start-with-ptvsd.py');
suite('Attach Debugger', () => {
    let debugClient;
    let proc;
    setup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!initialize_1.IS_MULTI_ROOT_TEST || !initialize_1.TEST_DEBUGGER) {
                this.skip();
            }
            this.timeout(30000);
            const coverageDirectory = path.join(constants_1.EXTENSION_ROOT_DIR, 'debug_coverage_attach_ptvsd');
            debugClient = yield utils_1.createDebugAdapter(coverageDirectory);
        });
    });
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        // Wait for a second before starting another test (sometimes, sockets take a while to get closed).
        yield common_1.sleep(1000);
        try {
            yield debugClient.stop().catch(() => { });
        }
        catch (ex) { }
        if (proc) {
            try {
                proc.kill();
            }
            catch (_a) { }
        }
    }));
    function testAttachingToRemoteProcess(localRoot, remoteRoot, isLocalHostWindows) {
        return __awaiter(this, void 0, void 0, function* () {
            const localHostPathSeparator = isLocalHostWindows ? '\\' : '/';
            const port = yield getFreePort({ host: 'localhost', port: 3000 });
            const env = Object.assign({}, process.env);
            // Set the path for PTVSD to be picked up.
            // tslint:disable-next-line:no-string-literal
            env['PYTHONPATH'] = constants_2.PTVSD_PATH;
            const pythonArgs = ['-m', 'ptvsd', '--host', 'localhost', '--wait', '--port', `${port}`, '--file', fileToDebug.fileToCommandArgument()];
            proc = child_process_1.spawn(common_1.PYTHON_PATH, pythonArgs, { env: env, cwd: path.dirname(fileToDebug) });
            const exited = new Promise(resolve => proc.once('close', resolve));
            yield common_1.sleep(3000);
            // Send initialize, attach
            const initializePromise = debugClient.initializeRequest({
                adapterID: constants_2.DebuggerTypeName,
                linesStartAt1: true,
                columnsStartAt1: true,
                supportsRunInTerminalRequest: true,
                pathFormat: 'path',
                supportsVariableType: true,
                supportsVariablePaging: true
            });
            const options = {
                name: 'attach',
                request: 'attach',
                localRoot,
                remoteRoot,
                type: constants_2.DebuggerTypeName,
                port: port,
                host: 'localhost',
                logToFile: false,
                debugOptions: [types_2.DebugOptions.RedirectOutput]
            };
            const platformService = TypeMoq.Mock.ofType();
            platformService.setup(p => p.isWindows).returns(() => isLocalHostWindows);
            const serviceContainer = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(types_1.IPlatformService, TypeMoq.It.isAny())).returns(() => platformService.object);
            const configProvider = new pythonV2Provider_1.PythonV2DebugConfigurationProvider(serviceContainer.object);
            yield configProvider.resolveDebugConfiguration({ index: 0, name: 'root', uri: vscode_1.Uri.file(localRoot) }, options);
            const attachPromise = debugClient.attachRequest(options);
            yield Promise.all([
                initializePromise,
                attachPromise,
                debugClient.waitForEvent('initialized')
            ]);
            const stdOutPromise = debugClient.assertOutput('stdout', 'this is stdout');
            const stdErrPromise = debugClient.assertOutput('stderr', 'this is stderr');
            // Don't use path utils, as we're building the paths manually (mimic windows paths on unix test servers and vice versa).
            const localFileName = `${localRoot}${localHostPathSeparator}${path.basename(fileToDebug)}`;
            const breakpointLocation = { path: localFileName, column: 1, line: 12 };
            const breakpointPromise = debugClient.setBreakpointsRequest({
                lines: [breakpointLocation.line],
                breakpoints: [{ line: breakpointLocation.line, column: breakpointLocation.column }],
                source: { path: breakpointLocation.path }
            });
            const exceptionBreakpointPromise = debugClient.setExceptionBreakpointsRequest({ filters: [] });
            const breakpointStoppedPromise = debugClient.assertStoppedLocation('breakpoint', breakpointLocation);
            yield Promise.all([
                breakpointPromise, exceptionBreakpointPromise,
                debugClient.configurationDoneRequest(), debugClient.threadsRequest(),
                stdOutPromise, stdErrPromise,
                breakpointStoppedPromise
            ]);
            yield utils_1.continueDebugging(debugClient);
            yield exited;
        });
    }
    test('Confirm we are able to attach to a running program', () => __awaiter(this, void 0, void 0, function* () {
        yield testAttachingToRemoteProcess(path.dirname(fileToDebug), path.dirname(fileToDebug), util_1.IS_WINDOWS);
    }));
});
//# sourceMappingURL=attach.ptvsd.test.js.map