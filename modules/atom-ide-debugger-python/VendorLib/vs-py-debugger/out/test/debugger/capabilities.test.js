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
// tslint:disable:no-suspicious-comment max-func-body-length no-invalid-this no-var-requires no-require-imports no-any no-object-literal-type-assertion no-banned-terms
const chai_1 = require("chai");
const child_process_1 = require("child_process");
const getFreePort = require("get-port");
const net_1 = require("net");
const path = require("path");
const messages_1 = require("vscode-debugadapter/lib/messages");
const constants_1 = require("../../client/common/constants");
const async_1 = require("../../client/common/utils/async");
const misc_1 = require("../../client/common/utils/misc");
const constants_2 = require("../../client/debugger/constants");
const protocolParser_1 = require("../../client/debugger/debugAdapter/Common/protocolParser");
const protocolWriter_1 = require("../../client/debugger/debugAdapter/Common/protocolWriter");
const main_1 = require("../../client/debugger/debugAdapter/main");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const fileToDebug = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'testMultiRootWkspc', 'workspace5', 'remoteDebugger-start-with-ptvsd-nowait.py');
suite('Debugging - Capabilities', function () {
    this.timeout(30000);
    let disposables;
    let proc;
    setup(function () {
        if (!initialize_1.IS_MULTI_ROOT_TEST || !initialize_1.TEST_DEBUGGER) {
            this.skip();
        }
        disposables = [];
    });
    teardown(() => {
        disposables.forEach(disposable => {
            try {
                disposable.dispose();
            }
            catch (_a) {
                misc_1.noop();
            }
            try {
                disposable.destroy();
            }
            catch (_b) {
                misc_1.noop();
            }
        });
        try {
            proc.kill();
        }
        catch (_a) {
            misc_1.noop();
        }
    });
    function createRequest(cmd, requestArgs) {
        return new class extends messages_1.Message {
            constructor(command, args) {
                super('request');
                this.command = command;
                this.arguments = args;
            }
        }(cmd, requestArgs);
    }
    function createDebugSession() {
        return new class extends main_1.PythonDebugger {
            constructor() {
                super({});
            }
            getInitializeResponseFromDebugAdapter() {
                let initializeResponse = {
                    body: {}
                };
                this.sendResponse = resp => initializeResponse = resp;
                this.initializeRequest(initializeResponse, { supportsRunInTerminalRequest: true, adapterID: '' });
                return initializeResponse;
            }
        }();
    }
    test('Compare capabilities', () => __awaiter(this, void 0, void 0, function* () {
        const customDebugger = createDebugSession();
        const expectedResponse = customDebugger.getInitializeResponseFromDebugAdapter();
        const protocolWriter = new protocolWriter_1.ProtocolMessageWriter();
        const initializeRequest = createRequest('initialize', { pathFormat: 'path' });
        const host = 'localhost';
        const port = yield getFreePort({ host, port: 3000 });
        const env = Object.assign({}, process.env);
        env.PYTHONPATH = constants_2.PTVSD_PATH;
        proc = child_process_1.spawn(common_1.PYTHON_PATH, ['-m', 'ptvsd', '--host', 'localhost', '--wait', '--port', `${port}`, '--file', fileToDebug], { cwd: path.dirname(fileToDebug), env });
        yield async_1.sleep(3000);
        const connected = async_1.createDeferred();
        const socket = new net_1.Socket();
        socket.on('error', connected.reject.bind(connected));
        socket.connect({ port, host }, () => connected.resolve(socket));
        yield connected.promise;
        const protocolParser = new protocolParser_1.ProtocolParser();
        protocolParser.connect(socket);
        disposables.push(protocolParser);
        const actualResponsePromise = new Promise(resolve => protocolParser.once('response_initialize', resolve));
        protocolWriter.write(socket, initializeRequest);
        const actualResponse = yield actualResponsePromise;
        const attachRequest = createRequest('attach', {
            name: 'attach',
            request: 'attach',
            type: 'python',
            port: port,
            host: 'localhost',
            logToFile: false,
            debugOptions: []
        });
        const attached = new Promise(resolve => protocolParser.once('response_attach', resolve));
        protocolWriter.write(socket, attachRequest);
        yield attached;
        const configRequest = createRequest('configurationDone', {});
        const configured = new Promise(resolve => protocolParser.once('response_configurationDone', resolve));
        protocolWriter.write(socket, configRequest);
        yield configured;
        protocolParser.dispose();
        // supportsDebuggerProperties is not documented, most probably a VS specific item.
        const body = actualResponse.body;
        delete body.supportsDebuggerProperties;
        chai_1.expect(actualResponse.body).to.deep.equal(expectedResponse.body);
    }));
});
//# sourceMappingURL=capabilities.test.js.map