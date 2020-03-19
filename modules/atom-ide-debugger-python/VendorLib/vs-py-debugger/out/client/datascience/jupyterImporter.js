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
const fs = require("fs-extra");
const inversify_1 = require("inversify");
const types_1 = require("../common/platform/types");
const types_2 = require("../common/process/types");
const types_3 = require("../common/types");
const async_1 = require("../common/utils/async");
const localize = require("../common/utils/localize");
const contracts_1 = require("../interpreter/contracts");
const types_4 = require("./types");
let JupyterImporter = class JupyterImporter {
    constructor(executionFactory, fileSystem, disposableRegistry, interpreterService, jupyterExecution) {
        this.executionFactory = executionFactory;
        this.fileSystem = fileSystem;
        this.disposableRegistry = disposableRegistry;
        this.interpreterService = interpreterService;
        this.jupyterExecution = jupyterExecution;
        this.isDisposed = false;
        // Template that changes markdown cells to have # %% [markdown] in the comments
        this.nbconvertTemplate = 
        // tslint:disable-next-line:no-multiline-string
        `{%- extends 'null.tpl' -%}
{% block codecell %}
#%%
{{ super() }}
{% endblock codecell %}
{% block in_prompt %}{% endblock in_prompt %}
{% block input %}{{ cell.source | ipython2python }}{% endblock input %}
{% block markdowncell scoped %}#%% [markdown]
{{ cell.source | comment_lines }}
{% endblock markdowncell %}`;
        this.importFromFile = (file) => __awaiter(this, void 0, void 0, function* () {
            const template = yield this.templatePromise;
            // Use the jupyter nbconvert functionality to turn the notebook into a python file
            if (yield this.jupyterExecution.isImportSupported()) {
                const result = yield this.jupyterExecution.execModule(['nbconvert', file, '--to', 'python', '--stdout', '--template', template], { throwOnStdErr: false, encoding: 'utf8' });
                if (result.stdout.trim().length === 0) {
                    throw result.stderr;
                }
                return result.stdout;
            }
            throw new Error(localize.DataScience.jupyterNbConvertNotSupported());
        });
        this.dispose = () => {
            this.isDisposed = true;
            this.settingsChangedDiposable.dispose();
        };
        this.createTemplateFile = () => __awaiter(this, void 0, void 0, function* () {
            // Create a temp file on disk
            const file = yield this.fileSystem.createTemporaryFile('.tpl');
            // Write our template into it
            yield fs.appendFile(file.filePath, this.nbconvertTemplate);
            // Save this file into our disposables so the temp file goes away
            this.disposableRegistry.push(file);
            // Now we should have a template that will convert
            return file.filePath;
        });
        this.onSettingsChanged = () => {
            // Recreate our promise for our execution service whenever the settings change
            this.createExecutionServicePromise();
        };
        this.createExecutionServicePromise = () => {
            // Create a deferred promise that resolves when we have an execution service
            this.pythonExecutionService = async_1.createDeferred();
            this.executionFactory
                .create({})
                .then((p) => { if (this.pythonExecutionService) {
                this.pythonExecutionService.resolve(p);
            } })
                .catch(err => { if (this.pythonExecutionService) {
                this.pythonExecutionService.reject(err);
            } });
        };
        this.settingsChangedDiposable = this.interpreterService.onDidChangeInterpreter(this.onSettingsChanged);
        this.templatePromise = this.createTemplateFile();
        this.createExecutionServicePromise();
    }
};
JupyterImporter = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IPythonExecutionFactory)),
    __param(1, inversify_1.inject(types_1.IFileSystem)),
    __param(2, inversify_1.inject(types_3.IDisposableRegistry)),
    __param(3, inversify_1.inject(contracts_1.IInterpreterService)),
    __param(4, inversify_1.inject(types_4.IJupyterExecution))
], JupyterImporter);
exports.JupyterImporter = JupyterImporter;
//# sourceMappingURL=jupyterImporter.js.map