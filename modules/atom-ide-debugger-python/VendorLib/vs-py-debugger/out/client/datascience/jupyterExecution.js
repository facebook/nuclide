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
const inversify_1 = require("inversify");
const types_1 = require("../common/process/types");
const types_2 = require("../common/types");
const contracts_1 = require("../interpreter/contracts");
let JupyterExecution = class JupyterExecution {
    constructor(executionFactory, condaService, interpreterService, logger) {
        this.executionFactory = executionFactory;
        this.condaService = condaService;
        this.interpreterService = interpreterService;
        this.logger = logger;
        this.execModuleObservable = (args, options) => __awaiter(this, void 0, void 0, function* () {
            const newOptions = Object.assign({}, options);
            newOptions.env = yield this.fixupCondaEnv(newOptions.env);
            const pythonService = yield this.executionFactory.create({});
            return pythonService.execModuleObservable('jupyter', args, newOptions);
        });
        this.execModule = (args, options) => __awaiter(this, void 0, void 0, function* () {
            const newOptions = Object.assign({}, options);
            newOptions.env = yield this.fixupCondaEnv(newOptions.env);
            const pythonService = yield this.executionFactory.create({});
            return pythonService.execModule('jupyter', args, newOptions);
        });
        this.isNotebookSupported = () => __awaiter(this, void 0, void 0, function* () {
            // Spawn jupyter notebook --version and see if it returns something
            try {
                const result = yield this.execModule(['notebook', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
                return (!result.stderr);
            }
            catch (err) {
                this.logger.logWarning(err);
                return false;
            }
        });
        this.isImportSupported = () => __awaiter(this, void 0, void 0, function* () {
            // Spawn jupyter nbconvert --version and see if it returns something
            try {
                const result = yield this.execModule(['nbconvert', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
                return (!result.stderr);
            }
            catch (err) {
                this.logger.logWarning(err);
                return false;
            }
        });
        /**
         * Conda needs specific paths and env vars set to be happy. Call this function to fix up
         * (or created if not present) our environment to run jupyter
         */
        // Base Node.js SpawnOptions uses any for environment, so use that here as well
        // tslint:disable-next-line:no-any
        this.fixupCondaEnv = (inputEnv) => __awaiter(this, void 0, void 0, function* () {
            if (!inputEnv) {
                inputEnv = process.env;
            }
            const interpreter = yield this.interpreterService.getActiveInterpreter();
            if (interpreter && interpreter.type === contracts_1.InterpreterType.Conda) {
                return this.condaService.getActivatedCondaEnvironment(interpreter, inputEnv);
            }
            return inputEnv;
        });
    }
};
JupyterExecution = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IPythonExecutionFactory)),
    __param(1, inversify_1.inject(contracts_1.ICondaService)),
    __param(2, inversify_1.inject(contracts_1.IInterpreterService)),
    __param(3, inversify_1.inject(types_2.ILogger))
], JupyterExecution);
exports.JupyterExecution = JupyterExecution;
//# sourceMappingURL=jupyterExecution.js.map