// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../common/extensions");
const services_1 = require("@jupyterlab/services");
const fs = require("fs-extra");
const inversify_1 = require("inversify");
const path = require("path");
const Observable_1 = require("rxjs/Observable");
const uuid = require("uuid/v4");
const vscode = require("vscode");
const types_1 = require("../common/application/types");
const types_2 = require("../common/platform/types");
const types_3 = require("../common/types");
const async_1 = require("../common/utils/async");
const localize = require("../common/utils/localize");
const constants_1 = require("./constants");
const jupyterInstallError_1 = require("./jupyterInstallError");
const types_4 = require("./types");
const contracts_1 = require("../interpreter/contracts");
// This code is based on the examples here:
// https://www.npmjs.com/package/@jupyterlab/services
let JupyterServer = class JupyterServer {
    constructor(logger, process, fileSystem, disposableRegistry, jupyterExecution, workspaceService, interpreterService) {
        this.logger = logger;
        this.process = process;
        this.fileSystem = fileSystem;
        this.disposableRegistry = disposableRegistry;
        this.jupyterExecution = jupyterExecution;
        this.workspaceService = workspaceService;
        this.interpreterService = interpreterService;
        this.isDisposed = false;
        this.onStatusChangedEvent = new vscode.EventEmitter();
        this.start = () => __awaiter(this, void 0, void 0, function* () {
            if (yield this.jupyterExecution.isNotebookSupported()) {
                // First generate a temporary notebook. We need this as input to the session
                this.tempFile = yield this.generateTempFile();
                // start our process in the same directory as our ipynb file.
                yield this.process.start(path.dirname(this.tempFile));
                // Wait for connection information. We'll stick that into the options
                const connInfo = yield this.process.waitForConnectionInformation();
                // First connect to the sesssion manager and find a kernel that matches our
                // python we're using
                const serverSettings = services_1.ServerConnection.makeSettings({
                    baseUrl: connInfo.baseUrl,
                    token: connInfo.token,
                    pageUrl: '',
                    // A web socket is required to allow token authentication
                    wsUrl: connInfo.baseUrl.replace('http', 'ws'),
                    init: { cache: 'no-store', credentials: 'same-origin' }
                });
                this.sessionManager = new services_1.SessionManager({ serverSettings: serverSettings });
                // Ask Jupyter for its list of kernel specs.
                const kernelName = yield this.findKernelName(this.sessionManager);
                // Create our session options using this temporary notebook and our connection info
                const options = {
                    path: this.tempFile,
                    kernelName: kernelName,
                    serverSettings: serverSettings
                };
                // Start a new session
                this.session = yield this.sessionManager.startNew(options);
                // Setup our start time. We reject anything that comes in before this time during execute
                this.sessionStartTime = Date.now();
                // Wait for it to be ready
                yield this.session.kernel.ready;
                // Check for dark theme, if so set matplot lib to use dark_background settings
                let darkTheme = false;
                const workbench = this.workspaceService.getConfiguration('workbench');
                if (workbench) {
                    const theme = workbench.get('colorTheme');
                    if (theme) {
                        darkTheme = /dark/i.test(theme);
                    }
                }
                this.executeSilently(`import pandas as pd\r\nimport numpy\r\n%matplotlib inline\r\nimport matplotlib.pyplot as plt${darkTheme ? '\r\nfrom matplotlib import style\r\nstyle.use(\'dark_background\')' : ''}`).ignoreErrors();
                return true;
            }
            else {
                throw new jupyterInstallError_1.JupyterInstallError(localize.DataScience.jupyterNotSupported(), localize.DataScience.pythonInteractiveHelpLink());
            }
        });
        this.shutdown = () => __awaiter(this, void 0, void 0, function* () {
            if (this.session) {
                yield this.sessionManager.shutdownAll();
                this.session.dispose();
                this.sessionManager.dispose();
                this.session = undefined;
                this.sessionManager = undefined;
            }
            if (this.process) {
                this.process.dispose();
            }
        });
        this.waitForIdle = () => __awaiter(this, void 0, void 0, function* () {
            if (this.session && this.session.kernel) {
                yield this.session.kernel.ready;
                while (this.session.kernel.status !== 'idle') {
                    yield this.timeout(10);
                }
            }
        });
        this.executeObservable = (code, file, line) => {
            // If we have a session, execute the code now.
            if (this.session) {
                // Replace windows line endings with unix line endings.
                const copy = code.replace(/\r\n/g, '\n');
                // Determine if we have a markdown cell/ markdown and code cell combined/ or just a code cell
                const split = copy.split('\n');
                const firstLine = split[0];
                if (constants_1.RegExpValues.PythonMarkdownCellMarker.test(firstLine)) {
                    // We have at least one markdown. We might have to split it if there any lines that don't begin
                    // with #
                    const firstNonMarkdown = split.findIndex((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
                    if (firstNonMarkdown >= 0) {
                        // We need to combine results
                        return this.combineObservables(this.executeMarkdownObservable(split.slice(0, firstNonMarkdown).join('\n'), file, line), this.executeCodeObservable(split.slice(firstNonMarkdown).join('\n'), file, line + firstNonMarkdown));
                    }
                    else {
                        // Just a normal markdown case
                        return this.combineObservables(this.executeMarkdownObservable(copy, file, line));
                    }
                }
                else {
                    // Normal code case
                    return this.combineObservables(this.executeCodeObservable(copy, file, line));
                }
            }
            // Can't run because no session
            return new Observable_1.Observable(subscriber => {
                subscriber.error(new Error(localize.DataScience.sessionDisposed()));
                subscriber.complete();
            });
        };
        this.executeSilently = (code) => {
            return new Promise((resolve, reject) => {
                // If we have a session, execute the code now.
                if (this.session) {
                    // Generate a new request and resolve when it's done.
                    const request = this.generateRequest(code, true);
                    if (request) {
                        // // For debugging purposes when silently is failing.
                        // request.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                        //     try {
                        //         this.logger.logInformation(`Execute silently message ${msg.header.msg_type} : hasData=${'data' in msg.content}`);
                        //     } catch (err) {
                        //         this.logger.logError(err);
                        //     }
                        // };
                        request.done.then(() => {
                            this.logger.logInformation(`Execute for ${code} silently finished.`);
                            resolve();
                        }).catch(reject);
                    }
                    else {
                        reject(new Error(localize.DataScience.sessionDisposed()));
                    }
                }
                else {
                    reject(new Error(localize.DataScience.sessionDisposed()));
                }
            });
        };
        this.dispose = () => __awaiter(this, void 0, void 0, function* () {
            if (!this.isDisposed) {
                this.isDisposed = true;
                this.onStatusChangedEvent.dispose();
                this.shutdown().ignoreErrors();
            }
        });
        this.restartKernel = () => __awaiter(this, void 0, void 0, function* () {
            if (this.session && this.session.kernel) {
                // Update our start time so we don't keep sending responses
                this.sessionStartTime = Date.now();
                // Restart our kernel
                yield this.session.kernel.restart();
                // Wait for it to be ready
                yield this.session.kernel.ready;
                return;
            }
            throw new Error(localize.DataScience.sessionDisposed());
        });
        this.translateToNotebook = (cells) => __awaiter(this, void 0, void 0, function* () {
            if (this.process) {
                // First we need the python version we're running
                const pythonVersion = yield this.process.waitForPythonVersionString();
                // Pull off the first number. Should be  3 or a 2
                const first = pythonVersion.substr(0, 1);
                // Use this to build our metadata object
                const metadata = {
                    kernelspec: {
                        display_name: `Python ${first}`,
                        language: 'python',
                        name: `python${first}`
                    },
                    language_info: {
                        name: 'python',
                        codemirror_mode: {
                            name: 'ipython',
                            version: parseInt(first, 10)
                        }
                    },
                    orig_nbformat: 2,
                    file_extension: '.py',
                    mimetype: 'text/x-python',
                    name: 'python',
                    npconvert_exporter: 'python',
                    pygments_lexer: `ipython${first}`,
                    version: pythonVersion
                };
                // Combine this into a JSON object
                return {
                    cells: cells.map((cell) => this.pruneCell(cell)),
                    nbformat: 4,
                    nbformat_minor: 2,
                    metadata: metadata
                };
            }
        });
        this.launchNotebook = (file) => __awaiter(this, void 0, void 0, function* () {
            if (this.process) {
                yield this.process.spawn(file);
                return true;
            }
            return false;
        });
        this.generateRequest = (code, silent) => {
            return this.session.kernel.requestExecute({
                // Replace windows line endings with unix line endings.
                code: code.replace(/\r\n/g, '\n'),
                stop_on_error: false,
                allow_stdin: false,
                silent: silent
            }, true);
        };
        this.findKernelName = (manager) => __awaiter(this, void 0, void 0, function* () {
            // Ask the session manager to refresh its list of kernel specs. We're going to
            // iterate through them finding the best match
            yield manager.refreshSpecs();
            // Extract our current python information that the user has picked.
            // We'll match against this.
            const pythonVersion = yield this.process.waitForPythonVersion();
            const pythonPath = yield this.process.waitForPythonPath();
            let bestScore = 0;
            let bestSpec;
            // Enumerate all of the kernel specs, scoring each as follows
            // - Path match = 10 Points. Very likely this is the right one
            // - Language match = 1 point. Might be a match
            // - Version match = 4 points for major version match
            const keys = Object.keys(manager.specs.kernelspecs);
            for (let i = 0; i < keys.length; i += 1) {
                const spec = manager.specs.kernelspecs[keys[i]];
                let score = 0;
                if (spec.argv.length > 0 && spec.argv[0] === pythonPath) {
                    // Path match
                    score += 10;
                }
                if (spec.language.toLocaleLowerCase() === 'python') {
                    // Language match
                    score += 1;
                    // See if the version is the same
                    if (pythonVersion && spec.argv.length > 0 && (yield fs.pathExists(spec.argv[0]))) {
                        const details = yield this.interpreterService.getInterpreterDetails(spec.argv[0]);
                        if (details && details.version_info) {
                            if (details.version_info[0] === pythonVersion[0]) {
                                // Major version match
                                score += 4;
                                if (details.version_info[1] === pythonVersion[1]) {
                                    // Minor version match
                                    score += 2;
                                    if (details.version_info[2] === pythonVersion[2]) {
                                        // Minor version match
                                        score += 1;
                                    }
                                }
                            }
                        }
                    }
                }
                // Update high score
                if (score > bestScore) {
                    bestScore = score;
                    bestSpec = spec.name;
                }
            }
            // If still not set, at least pick the first one
            if (!bestSpec && keys.length > 0) {
                bestSpec = manager.specs.kernelspecs[keys[0]].name;
            }
            return bestSpec;
        });
        this.combineObservables = (...args) => {
            return new Observable_1.Observable(subscriber => {
                // When all complete, we have our results
                const results = {};
                args.forEach(o => {
                    o.subscribe(c => {
                        results[c.id] = c;
                        // Convert to an array
                        const array = Object.keys(results).map((k) => {
                            return results[k];
                        });
                        // Update our subscriber of our total results if we have that many
                        if (array.length === args.length) {
                            subscriber.next(array);
                            // Complete when everybody is finished
                            if (array.every(a => a.state === types_4.CellState.finished || a.state === types_4.CellState.error)) {
                                subscriber.complete();
                            }
                        }
                    }, e => {
                        subscriber.error(e);
                    });
                });
            });
        };
        this.executeMarkdownObservable = (code, file, line) => {
            return new Observable_1.Observable(subscriber => {
                // Generate markdown by stripping out the comment and markdown header
                const markdown = this.appendLineFeed(code.split('\n').slice(1), s => s.trim().slice(1).trim());
                const cell = {
                    id: uuid(),
                    file: file,
                    line: line,
                    state: types_4.CellState.finished,
                    data: {
                        cell_type: 'markdown',
                        source: markdown,
                        metadata: {}
                    }
                };
                subscriber.next(cell);
                subscriber.complete();
            });
        };
        this.changeDirectoryIfPossible = (file, line) => __awaiter(this, void 0, void 0, function* () {
            if (line >= 0 && (yield fs.pathExists(file))) {
                const dir = path.dirname(file);
                yield this.executeSilently(`%cd "${dir}"`);
            }
        });
        this.handleCodeRequest = (subscriber, startTime, cell, code) => {
            // Generate a new request.
            const request = this.generateRequest(code, false);
            // Transition to the busy stage
            cell.state = types_4.CellState.executing;
            // Listen to the reponse messages and update state as we go
            if (request) {
                request.onIOPub = (msg) => {
                    try {
                        if (services_1.KernelMessage.isExecuteResultMsg(msg)) {
                            this.handleExecuteResult(msg, cell);
                        }
                        else if (services_1.KernelMessage.isExecuteInputMsg(msg)) {
                            this.handleExecuteInput(msg, cell);
                        }
                        else if (services_1.KernelMessage.isStatusMsg(msg)) {
                            this.handleStatusMessage(msg);
                        }
                        else if (services_1.KernelMessage.isStreamMsg(msg)) {
                            this.handleStreamMesssage(msg, cell);
                        }
                        else if (services_1.KernelMessage.isDisplayDataMsg(msg)) {
                            this.handleDisplayData(msg, cell);
                        }
                        else if (services_1.KernelMessage.isErrorMsg(msg)) {
                            this.handleError(msg, cell);
                        }
                        else {
                            this.logger.logWarning(`Unknown message ${msg.header.msg_type} : hasData=${'data' in msg.content}`);
                        }
                        // Set execution count, all messages should have it
                        if (msg.content.execution_count) {
                            cell.data.execution_count = msg.content.execution_count;
                        }
                        // Show our update if any new output
                        subscriber.next(cell);
                    }
                    catch (err) {
                        // If not a restart error, then tell the subscriber
                        if (startTime > this.sessionStartTime) {
                            this.logger.logError(`Error during message ${msg.header.msg_type}`);
                            subscriber.error(err);
                        }
                    }
                };
                // Create completion and error functions so we can bind our cell object
                // tslint:disable-next-line:no-any
                const completion = (error) => {
                    cell.state = error ? types_4.CellState.error : types_4.CellState.finished;
                    // Only do this if start time is still valid. Dont log an error to the subscriber. Error
                    // state should end up in the cell output.
                    if (startTime > this.sessionStartTime) {
                        subscriber.next(cell);
                    }
                    subscriber.complete();
                };
                // When the request finishes we are done
                request.done.then(completion).catch(completion);
            }
            else {
                subscriber.error(new Error(localize.DataScience.sessionDisposed()));
            }
        };
        this.addToCellData = (cell, output) => {
            const data = cell.data;
            data.outputs = [...data.outputs, output];
            cell.data = data;
        };
    }
    getCurrentState() {
        return Promise.resolve([]);
    }
    execute(code, file, line) {
        // Create a deferred that we'll fire when we're done
        const deferred = async_1.createDeferred();
        // Attempt to evaluate this cell in the jupyter notebook
        const observable = this.executeObservable(code, file, line);
        let output;
        observable.subscribe((cells) => {
            output = cells;
        }, (error) => {
            deferred.reject(error);
        }, () => {
            deferred.resolve(output);
        });
        // Wait for the execution to finish
        return deferred.promise;
    }
    get onStatusChanged() {
        return this.onStatusChangedEvent.event.bind(this.onStatusChangedEvent);
    }
    timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    pruneCell(cell) {
        // Remove the #%% of the top of the source if there is any. We don't need
        // this to end up in the exported ipynb file.
        const copy = Object.assign({}, cell.data);
        copy.source = this.pruneSource(cell.data.source);
        return copy;
    }
    pruneSource(source) {
        if (Array.isArray(source) && source.length > 0) {
            if (constants_1.RegExpValues.PythonCellMarker.test(source[0])) {
                return source.slice(1);
            }
        }
        else {
            const array = source.toString().split('\n').map(s => `${s}\n`);
            if (array.length > 0 && constants_1.RegExpValues.PythonCellMarker.test(array[0])) {
                return array.slice(1);
            }
        }
        return source;
    }
    appendLineFeed(arr, modifier) {
        return arr.map((s, i) => {
            const out = modifier ? modifier(s) : s;
            return i === arr.length - 1 ? `${out}` : `${out}\n`;
        });
    }
    executeCodeObservable(code, file, line) {
        return new Observable_1.Observable(subscriber => {
            // Start out empty;
            const cell = {
                data: {
                    source: this.appendLineFeed(code.split('\n')),
                    cell_type: 'code',
                    outputs: [],
                    metadata: {},
                    execution_count: 0
                },
                id: uuid(),
                file: file,
                line: line,
                state: types_4.CellState.init
            };
            // Keep track of when we started.
            const startTime = Date.now();
            // Tell our listener. NOTE: have to do this asap so that markdown cells don't get
            // run before our cells.
            subscriber.next(cell);
            // Attempt to change to the current directory. When that finishes
            // send our real request
            this.changeDirectoryIfPossible(file, line)
                .then(() => {
                this.handleCodeRequest(subscriber, startTime, cell, code);
            })
                .catch(() => {
                // Ignore errors if they occur. Just execute normally
                this.handleCodeRequest(subscriber, startTime, cell, code);
            });
        });
    }
    handleExecuteResult(msg, cell) {
        this.addToCellData(cell, { output_type: 'execute_result', data: msg.content.data, metadata: msg.content.metadata, execution_count: msg.content.execution_count });
    }
    handleExecuteInput(msg, cell) {
        cell.data.execution_count = msg.content.execution_count;
    }
    handleStatusMessage(msg) {
        if (msg.content.execution_state === 'busy') {
            this.onStatusChangedEvent.fire(true);
        }
        else {
            this.onStatusChangedEvent.fire(false);
        }
    }
    handleStreamMesssage(msg, cell) {
        const output = {
            output_type: 'stream',
            name: msg.content.name,
            text: msg.content.text
        };
        this.addToCellData(cell, output);
    }
    handleDisplayData(msg, cell) {
        const output = {
            output_type: 'display_data',
            data: msg.content.data,
            metadata: msg.content.metadata
        };
        this.addToCellData(cell, output);
    }
    handleError(msg, cell) {
        const output = {
            output_type: 'error',
            ename: msg.content.ename,
            evalue: msg.content.evalue,
            traceback: msg.content.traceback
        };
        this.addToCellData(cell, output);
    }
    generateTempFile() {
        return __awaiter(this, void 0, void 0, function* () {
            // Create a temp file on disk
            const file = yield this.fileSystem.createTemporaryFile('.ipynb');
            // Save in our list disposable
            this.disposableRegistry.push(file);
            return file.filePath;
        });
    }
};
JupyterServer = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.ILogger)),
    __param(1, inversify_1.inject(types_4.INotebookProcess)),
    __param(2, inversify_1.inject(types_2.IFileSystem)),
    __param(3, inversify_1.inject(types_3.IDisposableRegistry)),
    __param(4, inversify_1.inject(types_4.IJupyterExecution)),
    __param(5, inversify_1.inject(types_1.IWorkspaceService)),
    __param(6, inversify_1.inject(contracts_1.IInterpreterService))
], JupyterServer);
exports.JupyterServer = JupyterServer;
//# sourceMappingURL=jupyterServer.js.map