"use strict";
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
var JupyterProcess_1;
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
const inversify_1 = require("inversify");
const tk = require("tree-kill");
const url_1 = require("url");
const types_1 = require("../common/process/types");
const types_2 = require("../common/types");
const async_1 = require("../common/utils/async");
const types_3 = require("./types");
// This class communicates with an instance of jupyter that's running in the background
let JupyterProcess = JupyterProcess_1 = class JupyterProcess {
    constructor(executionFactory, jupyterExecution, logger) {
        this.executionFactory = executionFactory;
        this.jupyterExecution = jupyterExecution;
        this.logger = logger;
        this.isDisposed = false;
        this.start = (notebookdir) => __awaiter(this, void 0, void 0, function* () {
            // Compute args based on if inside a workspace or not
            const args = ['notebook', '--no-browser', `--notebook-dir=${notebookdir}`];
            // Setup our start promise
            this.startPromise = async_1.createDeferred();
            // Use the IPythonExecutionService to find Jupyter
            this.startObservable = yield this.jupyterExecution.execModuleObservable(args, { throwOnStdErr: false, encoding: 'utf8' });
            // Listen on stderr for its connection information
            this.startObservable.out.subscribe((output) => {
                if (output.source === 'stderr') {
                    this.extractConnectionInformation(output.out);
                }
                else {
                    this.output(output.out);
                }
            });
        });
        this.shutdown = () => __awaiter(this, void 0, void 0, function* () {
            if (this.startObservable && this.startObservable.proc) {
                if (!this.startObservable.proc.killed) {
                    tk(this.startObservable.proc.pid);
                }
                this.startObservable = undefined;
            }
        });
        this.spawn = (notebookFile) => __awaiter(this, void 0, void 0, function* () {
            // Compute args for the file
            const args = ['notebook', `--NotebookApp.file_to_run=${notebookFile}`];
            // Use the IPythonExecutionService to find Jupyter
            return this.jupyterExecution.execModule(args, { throwOnStdErr: true, encoding: 'utf8' });
        });
    }
    waitForPythonVersionString() {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonService = yield this.executionFactory.create({});
            const info = yield pythonService.getInterpreterInformation();
            return info ? info.version : '3';
        });
    }
    waitForPythonVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonService = yield this.executionFactory.create({});
            const info = yield pythonService.getInterpreterInformation();
            return info ? info.version_info : undefined;
        });
    }
    waitForPythonPath() {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonService = yield this.executionFactory.create({});
            const info = yield pythonService.getInterpreterInformation();
            return info ? info.path : undefined;
        });
    }
    // Returns the information necessary to talk to this instance
    waitForConnectionInformation() {
        if (this.startPromise) {
            return this.startPromise.promise;
        }
        return Promise.resolve({ baseUrl: '', token: '' });
    }
    dispose() {
        if (!this.isDisposed) {
            this.isDisposed = true;
            this.shutdown().ignoreErrors();
        }
    }
    // tslint:disable-next-line:no-any
    output(data) {
        if (this.logger) {
            this.logger.logInformation(data.toString('utf8'));
        }
    }
    // tslint:disable-next-line:no-any
    extractConnectionInformation(data) {
        this.output(data);
        // Look for a Jupyter Notebook url in the string received.
        const urlMatch = JupyterProcess_1.urlPattern.exec(data);
        if (urlMatch && this.startPromise) {
            const url = new url_1.URL(urlMatch[0]);
            this.startPromise.resolve({ baseUrl: `${url.protocol}//${url.host}/`, token: `${url.searchParams.get('token')}` });
        }
        // Do we need to worry about this not working? Timeout?
        // Look for 'Forbidden' in the result
        const forbiddenMatch = JupyterProcess_1.forbiddenPattern.exec(data);
        if (forbiddenMatch && this.startPromise && !this.startPromise.resolved) {
            this.startPromise.reject(new Error(data.toString('utf8')));
        }
    }
};
JupyterProcess.urlPattern = /http:\/\/localhost:[0-9]+\/\?token=[a-z0-9]+/g;
JupyterProcess.forbiddenPattern = /Forbidden/g;
JupyterProcess = JupyterProcess_1 = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IPythonExecutionFactory)),
    __param(1, inversify_1.inject(types_3.IJupyterExecution)),
    __param(2, inversify_1.inject(types_2.ILogger))
], JupyterProcess);
exports.JupyterProcess = JupyterProcess;
//# sourceMappingURL=jupyterProcess.js.map