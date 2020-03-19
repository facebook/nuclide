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
// tslint:disable:no-any max-func-body-length no-empty no-require-imports no-var-requires
if (Reflect.metadata === undefined) {
    require('reflect-metadata');
}
const os_1 = require("os");
const path = require("path");
const stream_1 = require("stream");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const logger_1 = require("vscode-debugadapter/lib/logger");
const constants_1 = require("../../common/constants");
require("../../common/extensions");
const helpers_1 = require("../../common/helpers");
const types_1 = require("../../common/platform/types");
const types_2 = require("../../common/types");
const async_1 = require("../../common/utils/async");
const misc_1 = require("../../common/utils/misc");
const DebugFactory_1 = require("./DebugClients/DebugFactory");
const serviceRegistry_1 = require("./serviceRegistry");
const types_3 = require("./types");
const killProcessTree = require('tree-kill');
const DEBUGGER_CONNECT_TIMEOUT = 20000;
const MIN_DEBUGGER_CONNECT_TIMEOUT = 5000;
/**
 * Primary purpose of this class is to perform the handshake with VS Code and launch PTVSD process.
 * I.e. it communicate with VS Code before PTVSD gets into the picture, once PTVSD is launched, PTVSD will talk directly to VS Code.
 * We're re-using DebugSession so we don't have to handle request/response ourselves.
 * @export
 * @class PythonDebugger
 * @extends {DebugSession}
 */
class PythonDebugger extends vscode_debugadapter_1.DebugSession {
    constructor(serviceContainer) {
        super(false);
        this.serviceContainer = serviceContainer;
        this.client = async_1.createDeferred();
        this.supportsRunInTerminalRequest = false;
    }
    shutdown() {
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = undefined;
        }
        super.shutdown();
    }
    initializeRequest(response, args) {
        const body = response.body;
        body.supportsExceptionInfoRequest = true;
        body.supportsConfigurationDoneRequest = true;
        body.supportsConditionalBreakpoints = true;
        body.supportsSetVariable = true;
        body.supportsExceptionOptions = true;
        body.supportsEvaluateForHovers = true;
        body.supportsModulesRequest = true;
        body.supportsValueFormattingOptions = true;
        body.supportsHitConditionalBreakpoints = true;
        body.supportsSetExpression = true;
        body.supportsLogPoints = true;
        body.supportTerminateDebuggee = true;
        body.supportsCompletionsRequest = true;
        body.exceptionBreakpointFilters = [
            {
                filter: 'raised',
                label: 'Raised Exceptions',
                default: false
            },
            {
                filter: 'uncaught',
                label: 'Uncaught Exceptions',
                default: true
            }
        ];
        if (typeof args.supportsRunInTerminalRequest === 'boolean') {
            this.supportsRunInTerminalRequest = args.supportsRunInTerminalRequest;
        }
        this.sendResponse(response);
    }
    attachRequest(response, args) {
        const launcher = DebugFactory_1.CreateAttachDebugClient(args, this);
        this.debugServer = launcher.CreateDebugServer(this.serviceContainer);
        this.debugServer.Start()
            .then(() => this.emit('debugger_attached'))
            .catch(ex => {
            vscode_debugadapter_1.logger.error('Attach failed');
            vscode_debugadapter_1.logger.error(`${ex}, ${ex.name}, ${ex.message}, ${ex.stack}`);
            const message = this.getUserFriendlyAttachErrorMessage(ex) || 'Attach Failed';
            this.sendErrorResponse(response, { format: message, id: 1 }, undefined, undefined, vscode_debugadapter_1.ErrorDestination.User);
        });
    }
    launchRequest(response, args) {
        const fs = this.serviceContainer.get(types_1.IFileSystem);
        if ((typeof args.module !== 'string' || args.module.length === 0) && args.program && !fs.fileExistsSync(args.program)) {
            return this.sendErrorResponse(response, { format: `File does not exist. "${args.program}"`, id: 1 }, undefined, undefined, vscode_debugadapter_1.ErrorDestination.User);
        }
        this.launchPTVSD(args)
            .then(() => this.waitForPTVSDToConnect(args))
            .then(() => this.emit('debugger_launched'))
            .catch(ex => {
            const message = this.getUserFriendlyLaunchErrorMessage(args, ex) || 'Debug Error';
            this.sendErrorResponse(response, { format: message, id: 1 }, undefined, undefined, vscode_debugadapter_1.ErrorDestination.User);
        });
    }
    launchPTVSD(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const launcher = DebugFactory_1.CreateLaunchDebugClient(args, this, this.supportsRunInTerminalRequest);
            this.debugServer = launcher.CreateDebugServer(this.serviceContainer);
            const serverInfo = yield this.debugServer.Start();
            return launcher.LaunchApplicationToDebug(serverInfo);
        });
    }
    waitForPTVSDToConnect(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let rejected = false;
                const duration = this.getConnectionTimeout(args);
                const timeout = setTimeout(() => {
                    rejected = true;
                    reject(new Error('Timeout waiting for debugger connection'));
                }, duration);
                try {
                    yield this.debugServer.client;
                    timeout.unref();
                    if (!rejected) {
                        resolve();
                    }
                }
                catch (ex) {
                    reject(ex);
                }
            }));
        });
    }
    getConnectionTimeout(args) {
        // The timeout can be overridden, but won't be documented unless we see the need for it.
        // This is just a fail safe mechanism, if the current timeout isn't enough (let study the current behaviour before exposing this setting).
        const connectionTimeout = typeof args.timeout === 'number' ? args.timeout : DEBUGGER_CONNECT_TIMEOUT;
        return Math.max(connectionTimeout, MIN_DEBUGGER_CONNECT_TIMEOUT);
    }
    getUserFriendlyLaunchErrorMessage(launchArgs, error) {
        if (!error) {
            return;
        }
        const errorMsg = typeof error === 'string' ? error : ((error.message && error.message.length > 0) ? error.message : '');
        if (helpers_1.isNotInstalledError(error)) {
            return `Failed to launch the Python Process, please validate the path '${launchArgs.pythonPath}'`;
        }
        else {
            return errorMsg;
        }
    }
    getUserFriendlyAttachErrorMessage(error) {
        if (!error) {
            return;
        }
        if (error.code === 'ECONNREFUSED' || error.errno === 'ECONNREFUSED') {
            return `Failed to attach (${error.message})`;
        }
        else {
            return typeof error === 'string' ? error : ((error.message && error.message.length > 0) ? error.message : '');
        }
    }
}
exports.PythonDebugger = PythonDebugger;
/**
 * Glue that orchestrates communications between VS Code, PythonDebugger (DebugSession) and PTVSD.
 * @class DebugManager
 * @implements {Disposable}
 */
class DebugManager {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
        this.isServerMode = false;
        this.disposables = [];
        this.hasShutdown = false;
        this.terminatedEventSent = false;
        this.disconnectResponseSent = false;
        this.restart = false;
        /**
         * Do not put any delays in here expecting VSC to receive messages. VSC could disconnect earlier (PTVSD #128).
         * If any delays are necessary, add them prior to calling this method.
         * If the program is forcefully terminated (e.g. killing terminal), we handle socket.on('error') or socket.on('close'),
         *  Under such circumstances, we need to send the terminated event asap (could be because VSC might be getting an error at its end due to piped stream being closed).
         * @private
         * @memberof DebugManager
         */
        // tslint:disable-next-line:cyclomatic-complexity
        this.shutdown = () => __awaiter(this, void 0, void 0, function* () {
            vscode_debugadapter_1.logger.verbose('check and shutdown');
            if (this.hasShutdown) {
                return;
            }
            this.hasShutdown = true;
            vscode_debugadapter_1.logger.verbose('shutdown');
            if (!this.terminatedEventSent && !this.restart) {
                // Possible PTVSD died before sending message back.
                try {
                    vscode_debugadapter_1.logger.verbose('Sending Terminated Event');
                    this.sendMessage(new vscode_debugadapter_1.TerminatedEvent(), this.outputStream);
                }
                catch (err) {
                    const message = `Error in sending Terminated Event: ${err && err.message ? err.message : err.toString()}`;
                    const details = [message, err && err.name ? err.name : '', err && err.stack ? err.stack : ''].join(os_1.EOL);
                    vscode_debugadapter_1.logger.error(`${message}${os_1.EOL}${details}`);
                }
                this.terminatedEventSent = true;
            }
            if (!this.disconnectResponseSent && this.restart && this.disconnectRequest) {
                // This is a work around for PTVSD bug, else this entire block is unnecessary.
                try {
                    vscode_debugadapter_1.logger.verbose('Sending Disconnect Response');
                    this.sendMessage(new vscode_debugadapter_1.Response(this.disconnectRequest, ''), this.outputStream);
                }
                catch (err) {
                    const message = `Error in sending Disconnect Response: ${err && err.message ? err.message : err.toString()}`;
                    const details = [message, err && err.name ? err.name : '', err && err.stack ? err.stack : ''].join(os_1.EOL);
                    vscode_debugadapter_1.logger.error(`${message}${os_1.EOL}${details}`);
                }
                this.disconnectResponseSent = true;
            }
            if (this.launchOrAttach === 'launch' && this.ptvsdProcessId) {
                vscode_debugadapter_1.logger.verbose('killing process');
                try {
                    // 1. Wait for some time, its possible the program has run to completion.
                    // We need to wait till the process exits (else the message `Terminated: 15` gets printed onto the screen).
                    // 2. Also, its possible we manually sent the `Terminated` event above.
                    // Hence we need to wait till VSC receives the above event.
                    yield async_1.sleep(100);
                    vscode_debugadapter_1.logger.verbose('Kill process now');
                    killProcessTree(this.ptvsdProcessId);
                }
                catch (_a) { }
                this.ptvsdProcessId = undefined;
            }
            if (!this.restart) {
                if (this.debugSession) {
                    vscode_debugadapter_1.logger.verbose('Shutting down debug session');
                    this.debugSession.shutdown();
                }
                vscode_debugadapter_1.logger.verbose('disposing');
                yield async_1.sleep(100);
                // Dispose last, we don't want to dispose the protocol loggers too early.
                this.disposables.forEach(disposable => disposable.dispose());
            }
        });
        /**
         * Connect PTVSD socket to VS Code.
         * This allows PTVSD to communicate directly with VS Code.
         * @private
         * @memberof DebugManager
         */
        this.connectVSCodeToPTVSD = (response) => __awaiter(this, void 0, void 0, function* () {
            const attachOrLaunchRequest = yield (this.launchOrAttach === 'attach' ? this.attachRequest : this.launchRequest);
            // By now we're connected to the client.
            this.socket = yield this.debugSession.debugServer.client;
            // We need to handle both end and error, sometimes the socket will error out without ending (if debugee is killed).
            // Note, we need a handler for the error event, else nodejs complains when socket gets closed and there are no error handlers.
            this.socket.on('end', () => {
                vscode_debugadapter_1.logger.verbose('Socket End');
                this.shutdown().ignoreErrors();
            });
            this.socket.on('error', () => {
                vscode_debugadapter_1.logger.verbose('Socket Error');
                this.shutdown().ignoreErrors();
            });
            // Keep track of processid for killing it.
            if (this.launchOrAttach === 'launch') {
                const debugSoketProtocolParser = this.serviceContainer.get(types_3.IProtocolParser);
                debugSoketProtocolParser.connect(this.socket);
                debugSoketProtocolParser.once('event_process', (proc) => {
                    this.ptvsdProcessId = proc.body.systemProcessId;
                });
            }
            // Get ready for PTVSD to communicate directly with VS Code.
            this.inputStream.unpipe(this.debugSessionInputStream);
            this.debugSessionOutputStream.unpipe(this.outputStream);
            // Do not pipe. When restarting the debugger, the socket gets closed,
            // In which case, VSC will see this and shutdown the debugger completely.
            this.inputStream.on('data', data => {
                this.socket.write(data);
            });
            this.socket.on('data', (data) => {
                this.throughOutputStream.write(data);
                this.outputStream.write(data);
            });
            // Send the launch/attach request to PTVSD and wait for it to reply back.
            this.sendMessage(attachOrLaunchRequest, this.socket);
            // Send the initialize request and wait for it to reply back with the initialized event
            this.sendMessage(yield this.initializeRequest, this.socket);
        });
        this.onRequestInitialize = (request) => {
            this.hasShutdown = false;
            this.terminatedEventSent = false;
            this.disconnectResponseSent = false;
            this.restart = false;
            this.disconnectRequest = undefined;
            this.initializeRequestDeferred.resolve(request);
        };
        this.onRequestLaunch = (request) => {
            this.launchOrAttach = 'launch';
            this.loggingEnabled = request.arguments.logToFile === true;
            this.launchRequestDeferred.resolve(request);
        };
        this.onRequestAttach = (request) => {
            this.launchOrAttach = 'attach';
            this.loggingEnabled = request.arguments.logToFile === true;
            this.attachRequestDeferred.resolve(request);
        };
        this.onRequestDisconnect = (request) => {
            this.disconnectRequest = request;
            if (this.launchOrAttach === 'attach') {
                return;
            }
            const args = request.arguments;
            if (args && args.restart) {
                this.restart = true;
            }
            // When VS Code sends a disconnect request, PTVSD replies back with a response.
            // Wait for sometime, untill the messages are sent out (remember, we're just intercepting streams here).
            setTimeout(this.shutdown, 500);
        };
        this.onEventTerminated = () => __awaiter(this, void 0, void 0, function* () {
            vscode_debugadapter_1.logger.verbose('onEventTerminated');
            this.terminatedEventSent = true;
            // Wait for sometime, untill the messages are sent out (remember, we're just intercepting streams here).
            setTimeout(this.shutdown, 300);
        });
        this.onResponseDisconnect = () => __awaiter(this, void 0, void 0, function* () {
            this.disconnectResponseSent = true;
            vscode_debugadapter_1.logger.verbose('onResponseDisconnect');
            // When VS Code sends a disconnect request, PTVSD replies back with a response, but its upto us to kill the process.
            // Wait for sometime, untill the messages are sent out (remember, we're just intercepting streams here).
            // Also its possible PTVSD might run to completion.
            setTimeout(this.shutdown, 100);
        });
        this.throughInputStream = new stream_1.PassThrough();
        this.throughOutputStream = new stream_1.PassThrough();
        this.debugSessionOutputStream = new stream_1.PassThrough();
        this.debugSessionInputStream = new stream_1.PassThrough();
        this.protocolMessageWriter = this.serviceContainer.get(types_3.IProtocolMessageWriter);
        this.inputProtocolParser = this.serviceContainer.get(types_3.IProtocolParser);
        this.inputProtocolParser.connect(this.throughInputStream);
        this.disposables.push(this.inputProtocolParser);
        this.outputProtocolParser = this.serviceContainer.get(types_3.IProtocolParser);
        this.outputProtocolParser.connect(this.throughOutputStream);
        this.disposables.push(this.outputProtocolParser);
        this.protocolLogger = this.serviceContainer.get(types_3.IProtocolLogger);
        this.protocolLogger.connect(this.throughInputStream, this.throughOutputStream);
        this.disposables.push(this.protocolLogger);
        this.initializeRequestDeferred = async_1.createDeferred();
        this.launchRequestDeferred = async_1.createDeferred();
        this.attachRequestDeferred = async_1.createDeferred();
    }
    get initializeRequest() {
        return this.initializeRequestDeferred.promise;
    }
    get launchRequest() {
        return this.launchRequestDeferred.promise;
    }
    get attachRequest() {
        return this.attachRequestDeferred.promise;
    }
    set loggingEnabled(value) {
        if (value) {
            vscode_debugadapter_1.logger.setup(logger_1.LogLevel.Verbose, true);
            this.protocolLogger.setup(vscode_debugadapter_1.logger);
        }
    }
    dispose() {
        vscode_debugadapter_1.logger.verbose('main dispose');
        this.shutdown().ignoreErrors();
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            const debugStreamProvider = this.serviceContainer.get(types_3.IDebugStreamProvider);
            const { input, output } = yield debugStreamProvider.getInputAndOutputStreams();
            this.isServerMode = debugStreamProvider.useDebugSocketStream;
            this.inputStream = input;
            this.outputStream = output;
            this.inputStream.pause();
            if (!this.isServerMode) {
                const currentProcess = this.serviceContainer.get(types_2.ICurrentProcess);
                currentProcess.on('SIGTERM', () => {
                    if (!this.restart) {
                        this.shutdown().ignoreErrors();
                    }
                });
            }
            this.interceptProtocolMessages();
            this.startDebugSession();
        });
    }
    sendMessage(message, outputStream) {
        this.protocolMessageWriter.write(outputStream, message);
        this.protocolMessageWriter.write(this.throughOutputStream, message);
    }
    startDebugSession() {
        this.debugSession = new PythonDebugger(this.serviceContainer);
        this.debugSession.setRunAsServer(this.isServerMode);
        this.debugSession.once('debugger_attached', this.connectVSCodeToPTVSD);
        this.debugSession.once('debugger_launched', this.connectVSCodeToPTVSD);
        this.debugSessionOutputStream.pipe(this.throughOutputStream);
        this.debugSessionOutputStream.pipe(this.outputStream);
        // Start handling requests in the session instance.
        // The session (PythonDebugger class) will only perform the bootstrapping (launching of PTVSD).
        this.inputStream.pipe(this.throughInputStream);
        this.inputStream.pipe(this.debugSessionInputStream);
        this.debugSession.start(this.debugSessionInputStream, this.debugSessionOutputStream);
    }
    interceptProtocolMessages() {
        // Keep track of the initialize and launch requests, we'll need to re-send these to ptvsd, for bootstrapping.
        this.inputProtocolParser.once('request_initialize', this.onRequestInitialize);
        this.inputProtocolParser.once('request_launch', this.onRequestLaunch);
        this.inputProtocolParser.once('request_attach', this.onRequestAttach);
        this.inputProtocolParser.once('request_disconnect', this.onRequestDisconnect);
        this.outputProtocolParser.once('event_terminated', this.onEventTerminated);
        this.outputProtocolParser.once('response_disconnect', this.onResponseDisconnect);
    }
}
function startDebugger() {
    return __awaiter(this, void 0, void 0, function* () {
        vscode_debugadapter_1.logger.init(misc_1.noop, path.join(constants_1.EXTENSION_ROOT_DIR, `debug${process.pid}.log`));
        const serviceContainer = serviceRegistry_1.initializeIoc();
        const protocolMessageWriter = serviceContainer.get(types_3.IProtocolMessageWriter);
        try {
            // debugger;
            const debugManager = new DebugManager(serviceContainer);
            yield debugManager.start();
        }
        catch (err) {
            const message = `Debugger Error: ${err && err.message ? err.message : err.toString()}`;
            const details = [message, err && err.name ? err.name : '', err && err.stack ? err.stack : ''].join(os_1.EOL);
            vscode_debugadapter_1.logger.error(`${message}${os_1.EOL}${details}`);
            // Notify the user.
            protocolMessageWriter.write(process.stdout, new vscode_debugadapter_1.Event('error', message));
            protocolMessageWriter.write(process.stdout, new vscode_debugadapter_1.OutputEvent(`${message}${os_1.EOL}${details}`, 'stderr'));
        }
    });
}
process.stdin.on('error', () => { });
process.stdout.on('error', () => { });
process.stderr.on('error', () => { });
process.on('uncaughtException', (err) => {
    vscode_debugadapter_1.logger.error(`Uncaught Exception: ${err && err.message ? err.message : ''}`);
    vscode_debugadapter_1.logger.error(err && err.name ? err.name : '');
    vscode_debugadapter_1.logger.error(err && err.stack ? err.stack : '');
    // Catch all, incase we have string exceptions being raised.
    vscode_debugadapter_1.logger.error(err ? err.toString() : '');
    // Wait for 1 second before we die, we need to ensure errors are written to the log file.
    setTimeout(() => process.exit(-1), 100);
});
startDebugger().catch(ex => {
    // Not necessary except for debugging and to kill linter warning about unhandled promises.
});
//# sourceMappingURL=main.js.map