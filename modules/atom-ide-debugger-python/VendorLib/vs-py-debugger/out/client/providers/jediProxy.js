"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
const path = require("path");
const pidusage = require("pidusage");
const vscode_1 = require("vscode");
const configSettings_1 = require("../common/configSettings");
const constants_1 = require("../common/constants");
require("../common/extensions");
const types_1 = require("../common/process/types");
const types_2 = require("../common/types");
const async_1 = require("../common/utils/async");
const decorators_1 = require("../common/utils/decorators");
const stopWatch_1 = require("../common/utils/stopWatch");
const types_3 = require("../common/variables/types");
const logger_1 = require("./../common/logger");
const IS_WINDOWS = /^win/.test(process.platform);
const pythonVSCodeTypeMappings = new Map();
pythonVSCodeTypeMappings.set('none', vscode_1.CompletionItemKind.Value);
pythonVSCodeTypeMappings.set('type', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('tuple', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dict', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dictionary', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('function', vscode_1.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('lambda', vscode_1.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('generator', vscode_1.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('class', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('instance', vscode_1.CompletionItemKind.Reference);
pythonVSCodeTypeMappings.set('method', vscode_1.CompletionItemKind.Method);
pythonVSCodeTypeMappings.set('builtin', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('builtinfunction', vscode_1.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('module', vscode_1.CompletionItemKind.Module);
pythonVSCodeTypeMappings.set('file', vscode_1.CompletionItemKind.File);
pythonVSCodeTypeMappings.set('xrange', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('slice', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('traceback', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('frame', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('buffer', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dictproxy', vscode_1.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('funcdef', vscode_1.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('property', vscode_1.CompletionItemKind.Property);
pythonVSCodeTypeMappings.set('import', vscode_1.CompletionItemKind.Module);
pythonVSCodeTypeMappings.set('keyword', vscode_1.CompletionItemKind.Keyword);
pythonVSCodeTypeMappings.set('constant', vscode_1.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('variable', vscode_1.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('value', vscode_1.CompletionItemKind.Value);
pythonVSCodeTypeMappings.set('param', vscode_1.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('statement', vscode_1.CompletionItemKind.Keyword);
const pythonVSCodeSymbolMappings = new Map();
pythonVSCodeSymbolMappings.set('none', vscode_1.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('type', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('tuple', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('dict', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('dictionary', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('function', vscode_1.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('lambda', vscode_1.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('generator', vscode_1.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('class', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('instance', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('method', vscode_1.SymbolKind.Method);
pythonVSCodeSymbolMappings.set('builtin', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('builtinfunction', vscode_1.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('module', vscode_1.SymbolKind.Module);
pythonVSCodeSymbolMappings.set('file', vscode_1.SymbolKind.File);
pythonVSCodeSymbolMappings.set('xrange', vscode_1.SymbolKind.Array);
pythonVSCodeSymbolMappings.set('slice', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('traceback', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('frame', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('buffer', vscode_1.SymbolKind.Array);
pythonVSCodeSymbolMappings.set('dictproxy', vscode_1.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('funcdef', vscode_1.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('property', vscode_1.SymbolKind.Property);
pythonVSCodeSymbolMappings.set('import', vscode_1.SymbolKind.Module);
pythonVSCodeSymbolMappings.set('keyword', vscode_1.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('constant', vscode_1.SymbolKind.Constant);
pythonVSCodeSymbolMappings.set('variable', vscode_1.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('value', vscode_1.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('param', vscode_1.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('statement', vscode_1.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('boolean', vscode_1.SymbolKind.Boolean);
pythonVSCodeSymbolMappings.set('int', vscode_1.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('longlean', vscode_1.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('float', vscode_1.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('complex', vscode_1.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('string', vscode_1.SymbolKind.String);
pythonVSCodeSymbolMappings.set('unicode', vscode_1.SymbolKind.String);
pythonVSCodeSymbolMappings.set('list', vscode_1.SymbolKind.Array);
function getMappedVSCodeType(pythonType) {
    if (pythonVSCodeTypeMappings.has(pythonType)) {
        const value = pythonVSCodeTypeMappings.get(pythonType);
        if (value) {
            return value;
        }
    }
    return vscode_1.CompletionItemKind.Keyword;
}
function getMappedVSCodeSymbol(pythonType) {
    if (pythonVSCodeSymbolMappings.has(pythonType)) {
        const value = pythonVSCodeSymbolMappings.get(pythonType);
        if (value) {
            return value;
        }
    }
    return vscode_1.SymbolKind.Variable;
}
var CommandType;
(function (CommandType) {
    CommandType[CommandType["Arguments"] = 0] = "Arguments";
    CommandType[CommandType["Completions"] = 1] = "Completions";
    CommandType[CommandType["Hover"] = 2] = "Hover";
    CommandType[CommandType["Usages"] = 3] = "Usages";
    CommandType[CommandType["Definitions"] = 4] = "Definitions";
    CommandType[CommandType["Symbols"] = 5] = "Symbols";
})(CommandType = exports.CommandType || (exports.CommandType = {}));
const commandNames = new Map();
commandNames.set(CommandType.Arguments, 'arguments');
commandNames.set(CommandType.Completions, 'completions');
commandNames.set(CommandType.Definitions, 'definitions');
commandNames.set(CommandType.Hover, 'tooltip');
commandNames.set(CommandType.Usages, 'usages');
commandNames.set(CommandType.Symbols, 'names');
class JediProxy {
    constructor(extensionRootDir, workspacePath, serviceContainer) {
        this.extensionRootDir = extensionRootDir;
        this.serviceContainer = serviceContainer;
        this.cmdId = 0;
        this.previousData = '';
        this.commands = new Map();
        this.commandQueue = [];
        this.spawnRetryAttempts = 0;
        this.additionalAutoCompletePaths = [];
        this.ignoreJediMemoryFootprint = false;
        this.pidUsageFailures = { timer: new stopWatch_1.StopWatch(), counter: 0 };
        this.workspacePath = workspacePath;
        this.pythonSettings = configSettings_1.PythonSettings.getInstance(vscode_1.Uri.file(workspacePath));
        this.lastKnownPythonInterpreter = this.pythonSettings.pythonPath;
        this.logger = serviceContainer.get(types_2.ILogger);
        this.pythonSettings.on('change', () => this.pythonSettingsChangeHandler());
        this.initialized = async_1.createDeferred();
        this.startLanguageServer().then(() => this.initialized.resolve()).ignoreErrors();
        this.proposeNewLanguageServerPopup = serviceContainer.get(types_2.IPythonExtensionBanner, types_2.BANNER_NAME_PROPOSE_LS);
        this.checkJediMemoryFootprint().ignoreErrors();
    }
    static getProperty(o, name) {
        return o[name];
    }
    dispose() {
        this.killProcess();
    }
    getNextCommandId() {
        const result = this.cmdId;
        this.cmdId += 1;
        return result;
    }
    sendCommand(cmd) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initialized.promise;
            yield this.languageServerStarted.promise;
            if (!this.proc) {
                return Promise.reject(new Error('Python proc not initialized'));
            }
            const executionCmd = cmd;
            const payload = this.createPayload(executionCmd);
            executionCmd.deferred = async_1.createDeferred();
            try {
                this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
                this.commands.set(executionCmd.id, executionCmd);
                this.commandQueue.push(executionCmd.id);
            }
            catch (ex) {
                console.error(ex);
                //If 'This socket is closed.' that means process didn't start at all (at least not properly).
                if (ex.message === 'This socket is closed.') {
                    this.killProcess();
                }
                else {
                    this.handleError('sendCommand', ex.message);
                }
                return Promise.reject(ex);
            }
            return executionCmd.deferred.promise;
        });
    }
    // keep track of the directory so we can re-spawn the process.
    initialize() {
        return this.spawnProcess(path.join(this.extensionRootDir, 'pythonFiles'))
            .catch(ex => {
            if (this.languageServerStarted) {
                this.languageServerStarted.reject(ex);
            }
            this.handleError('spawnProcess', ex);
        });
    }
    shouldCheckJediMemoryFootprint() {
        if (this.ignoreJediMemoryFootprint || this.pythonSettings.jediMemoryLimit === -1) {
            return false;
        }
        if (this.lastCmdIdProcessedForPidUsage && this.lastCmdIdProcessed &&
            this.lastCmdIdProcessedForPidUsage === this.lastCmdIdProcessed) {
            // If no more commands were processed since the last time,
            //  then there's no need to check again.
            return false;
        }
        return true;
    }
    checkJediMemoryFootprint() {
        return __awaiter(this, void 0, void 0, function* () {
            // Check memory footprint periodically. Do not check on every request due to
            // the performance impact. See https://github.com/soyuka/pidusage - on Windows
            // it is using wmic which means spawning cmd.exe process on every request.
            if (this.pythonSettings.jediMemoryLimit === -1) {
                return;
            }
            yield this.checkJediMemoryFootprintImpl();
            setTimeout(() => this.checkJediMemoryFootprint(), 15 * 1000);
        });
    }
    checkJediMemoryFootprintImpl() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.proc || this.proc.killed) {
                return;
            }
            if (!this.shouldCheckJediMemoryFootprint()) {
                return;
            }
            this.lastCmdIdProcessedForPidUsage = this.lastCmdIdProcessed;
            // Do not run pidusage over and over, wait for it to finish.
            const deferred = async_1.createDeferred();
            pidusage.stat(this.proc.pid, (err, result) => __awaiter(this, void 0, void 0, function* () {
                if (err) {
                    this.pidUsageFailures.counter += 1;
                    // If this function fails 2 times in the last 60 seconds, lets not try ever again.
                    if (this.pidUsageFailures.timer.elapsedTime > 60 * 1000) {
                        this.ignoreJediMemoryFootprint = this.pidUsageFailures.counter > 2;
                        this.pidUsageFailures.counter = 0;
                        this.pidUsageFailures.timer.reset();
                    }
                    console.error('Python Extension: (pidusage)', err);
                }
                else {
                    const limit = Math.min(Math.max(this.pythonSettings.jediMemoryLimit, 1024), 8192);
                    if (result && result.memory > limit * 1024 * 1024) {
                        this.logger.logWarning(`IntelliSense process memory consumption exceeded limit of ${limit} MB and process will be restarted.\nThe limit is controlled by the 'python.jediMemoryLimit' setting.`);
                        yield this.restartLanguageServer();
                    }
                }
                deferred.resolve();
            }));
            return deferred.promise;
        });
    }
    pythonSettingsChangeHandler() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.lastKnownPythonInterpreter === this.pythonSettings.pythonPath) {
                return;
            }
            this.lastKnownPythonInterpreter = this.pythonSettings.pythonPath;
            this.additionalAutoCompletePaths = yield this.buildAutoCompletePaths();
            this.restartLanguageServer().ignoreErrors();
        });
    }
    environmentVariablesChangeHandler() {
        return __awaiter(this, void 0, void 0, function* () {
            const newAutoComletePaths = yield this.buildAutoCompletePaths();
            if (this.additionalAutoCompletePaths.join(',') !== newAutoComletePaths.join(',')) {
                this.additionalAutoCompletePaths = newAutoComletePaths;
                this.restartLanguageServer().ignoreErrors();
            }
        });
    }
    startLanguageServer() {
        return __awaiter(this, void 0, void 0, function* () {
            const newAutoComletePaths = yield this.buildAutoCompletePaths();
            this.additionalAutoCompletePaths = newAutoComletePaths;
            if (!constants_1.isTestExecution()) {
                yield this.proposeNewLanguageServerPopup.showBanner();
            }
            return this.restartLanguageServer();
        });
    }
    restartLanguageServer() {
        this.killProcess();
        this.clearPendingRequests();
        return this.initialize();
    }
    clearPendingRequests() {
        this.commandQueue = [];
        this.commands.forEach(item => {
            if (item.deferred !== undefined) {
                item.deferred.resolve();
            }
        });
        this.commands.clear();
    }
    killProcess() {
        try {
            if (this.proc) {
                this.proc.kill();
            }
            // tslint:disable-next-line:no-empty
        }
        catch (ex) { }
        this.proc = undefined;
    }
    handleError(source, errorMessage) {
        logger_1.Logger.error(`${source} jediProxy`, `Error (${source}) ${errorMessage}`);
    }
    // tslint:disable-next-line:max-func-body-length
    spawnProcess(cwd) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.languageServerStarted && !this.languageServerStarted.completed) {
                this.languageServerStarted.reject(new Error('Language Server not started.'));
            }
            this.languageServerStarted = async_1.createDeferred();
            const pythonProcess = yield this.serviceContainer.get(types_1.IPythonExecutionFactory).create({ resource: vscode_1.Uri.file(this.workspacePath) });
            // Check if the python path is valid.
            if ((yield pythonProcess.getExecutablePath().catch(() => '')).length === 0) {
                return;
            }
            const args = ['completion.py'];
            if (typeof this.pythonSettings.jediPath === 'string' && this.pythonSettings.jediPath.length > 0) {
                args.push('custom');
                args.push(this.pythonSettings.jediPath);
            }
            const result = pythonProcess.execObservable(args, { cwd });
            this.proc = result.proc;
            this.languageServerStarted.resolve();
            this.proc.on('end', (end) => {
                logger_1.Logger.error('spawnProcess.end', `End - ${end}`);
            });
            this.proc.on('error', error => {
                this.handleError('error', `${error}`);
                this.spawnRetryAttempts += 1;
                if (this.spawnRetryAttempts < 10 && error && error.message &&
                    error.message.indexOf('This socket has been ended by the other party') >= 0) {
                    this.spawnProcess(cwd)
                        .catch(ex => {
                        if (this.languageServerStarted) {
                            this.languageServerStarted.reject(ex);
                        }
                        this.handleError('spawnProcess', ex);
                    });
                }
            });
            result.out.subscribe(output => {
                if (output.source === 'stderr') {
                    this.handleError('stderr', output.out);
                }
                else {
                    const data = output.out;
                    // Possible there was an exception in parsing the data returned,
                    // so append the data and then parse it.
                    const dataStr = this.previousData = `${this.previousData}${data}`;
                    // tslint:disable-next-line:no-any
                    let responses;
                    try {
                        responses = dataStr.splitLines().map(resp => JSON.parse(resp));
                        this.previousData = '';
                    }
                    catch (ex) {
                        // Possible we've only received part of the data, hence don't clear previousData.
                        // Don't log errors when we haven't received the entire response.
                        if (ex.message.indexOf('Unexpected end of input') === -1 &&
                            ex.message.indexOf('Unexpected end of JSON input') === -1 &&
                            ex.message.indexOf('Unexpected token') === -1) {
                            this.handleError('stdout', ex.message);
                        }
                        return;
                    }
                    responses.forEach((response) => {
                        if (!response) {
                            return;
                        }
                        const responseId = JediProxy.getProperty(response, 'id');
                        if (!this.commands.has(responseId)) {
                            return;
                        }
                        const cmd = this.commands.get(responseId);
                        if (!cmd) {
                            return;
                        }
                        this.lastCmdIdProcessed = cmd.id;
                        if (JediProxy.getProperty(response, 'arguments')) {
                            this.commandQueue.splice(this.commandQueue.indexOf(cmd.id), 1);
                            return;
                        }
                        this.commands.delete(responseId);
                        const index = this.commandQueue.indexOf(cmd.id);
                        if (index) {
                            this.commandQueue.splice(index, 1);
                        }
                        // Check if this command has expired.
                        if (cmd.token.isCancellationRequested) {
                            this.safeResolve(cmd, undefined);
                            return;
                        }
                        const handler = this.getCommandHandler(cmd.command);
                        if (handler) {
                            handler.call(this, cmd, response);
                        }
                        // Check if too many pending requests.
                        this.checkQueueLength();
                    });
                }
            }, error => this.handleError('subscription.error', `${error}`));
        });
    }
    getCommandHandler(command) {
        switch (command) {
            case CommandType.Completions:
                return this.onCompletion;
            case CommandType.Definitions:
                return this.onDefinition;
            case CommandType.Hover:
                return this.onHover;
            case CommandType.Symbols:
                return this.onSymbols;
            case CommandType.Usages:
                return this.onUsages;
            case CommandType.Arguments:
                return this.onArguments;
            default:
                return;
        }
    }
    onCompletion(command, response) {
        let results = JediProxy.getProperty(response, 'results');
        results = Array.isArray(results) ? results : [];
        results.forEach(item => {
            // tslint:disable-next-line:no-any
            const originalType = item.type;
            item.type = getMappedVSCodeType(originalType);
            item.kind = getMappedVSCodeSymbol(originalType);
            item.rawType = getMappedVSCodeType(originalType);
        });
        const completionResult = {
            items: results,
            requestId: command.id
        };
        this.safeResolve(command, completionResult);
    }
    onDefinition(command, response) {
        // tslint:disable-next-line:no-any
        const defs = JediProxy.getProperty(response, 'results');
        const defResult = {
            requestId: command.id,
            definitions: []
        };
        if (defs.length > 0) {
            defResult.definitions = defs.map(def => {
                const originalType = def.type;
                return {
                    fileName: def.fileName,
                    text: def.text,
                    rawType: originalType,
                    type: getMappedVSCodeType(originalType),
                    kind: getMappedVSCodeSymbol(originalType),
                    container: def.container,
                    range: {
                        startLine: def.range.start_line,
                        startColumn: def.range.start_column,
                        endLine: def.range.end_line,
                        endColumn: def.range.end_column
                    }
                };
            });
        }
        this.safeResolve(command, defResult);
    }
    onHover(command, response) {
        // tslint:disable-next-line:no-any
        const defs = JediProxy.getProperty(response, 'results');
        const defResult = {
            requestId: command.id,
            items: defs.map(def => {
                return {
                    kind: getMappedVSCodeSymbol(def.type),
                    description: def.description,
                    signature: def.signature,
                    docstring: def.docstring,
                    text: def.text
                };
            })
        };
        this.safeResolve(command, defResult);
    }
    onSymbols(command, response) {
        // tslint:disable-next-line:no-any
        let defs = JediProxy.getProperty(response, 'results');
        defs = Array.isArray(defs) ? defs : [];
        const defResults = {
            requestId: command.id,
            definitions: []
        };
        defResults.definitions = defs.map(def => {
            const originalType = def.type;
            return {
                fileName: def.fileName,
                text: def.text,
                rawType: originalType,
                type: getMappedVSCodeType(originalType),
                kind: getMappedVSCodeSymbol(originalType),
                container: def.container,
                range: {
                    startLine: def.range.start_line,
                    startColumn: def.range.start_column,
                    endLine: def.range.end_line,
                    endColumn: def.range.end_column
                }
            };
        });
        this.safeResolve(command, defResults);
    }
    onUsages(command, response) {
        // tslint:disable-next-line:no-any
        let defs = JediProxy.getProperty(response, 'results');
        defs = Array.isArray(defs) ? defs : [];
        const refResult = {
            requestId: command.id,
            references: defs.map(item => {
                return {
                    columnIndex: item.column,
                    fileName: item.fileName,
                    lineIndex: item.line - 1,
                    moduleName: item.moduleName,
                    name: item.name
                };
            })
        };
        this.safeResolve(command, refResult);
    }
    onArguments(command, response) {
        // tslint:disable-next-line:no-any
        const defs = JediProxy.getProperty(response, 'results');
        // tslint:disable-next-line:no-object-literal-type-assertion
        this.safeResolve(command, {
            requestId: command.id,
            definitions: defs
        });
    }
    checkQueueLength() {
        if (this.commandQueue.length > 10) {
            const items = this.commandQueue.splice(0, this.commandQueue.length - 10);
            items.forEach(id => {
                if (this.commands.has(id)) {
                    const cmd1 = this.commands.get(id);
                    try {
                        this.safeResolve(cmd1, undefined);
                        // tslint:disable-next-line:no-empty
                    }
                    catch (ex) {
                    }
                    finally {
                        this.commands.delete(id);
                    }
                }
            });
        }
    }
    // tslint:disable-next-line:no-any
    createPayload(cmd) {
        const payload = {
            id: cmd.id,
            prefix: '',
            lookup: commandNames.get(cmd.command),
            path: cmd.fileName,
            source: cmd.source,
            line: cmd.lineIndex,
            column: cmd.columnIndex,
            config: this.getConfig()
        };
        if (cmd.command === CommandType.Symbols) {
            delete payload.column;
            delete payload.line;
        }
        return payload;
    }
    getPathFromPythonCommand(args) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const pythonProcess = yield this.serviceContainer.get(types_1.IPythonExecutionFactory).create({ resource: vscode_1.Uri.file(this.workspacePath) });
                const result = yield pythonProcess.exec(args, { cwd: this.workspacePath });
                const lines = result.stdout.trim().splitLines();
                if (lines.length === 0) {
                    return '';
                }
                const exists = yield fs.pathExists(lines[0]);
                return exists ? lines[0] : '';
            }
            catch (_a) {
                return '';
            }
        });
    }
    buildAutoCompletePaths() {
        return __awaiter(this, void 0, void 0, function* () {
            const filePathPromises = [
                // Sysprefix.
                this.getPathFromPythonCommand(['-c', 'import sys;print(sys.prefix)']).catch(() => ''),
                // exeucutable path.
                this.getPathFromPythonCommand(['-c', 'import sys;print(sys.executable)']).then(execPath => path.dirname(execPath)).catch(() => ''),
                // Python specific site packages.
                // On windows we also need the libs path (second item will return c:\xxx\lib\site-packages).
                // This is returned by "from distutils.sysconfig import get_python_lib; print(get_python_lib())".
                this.getPathFromPythonCommand(['-c', 'from distutils.sysconfig import get_python_lib; print(get_python_lib())'])
                    .then(libPath => {
                    // On windows we also need the libs path (second item will return c:\xxx\lib\site-packages).
                    // This is returned by "from distutils.sysconfig import get_python_lib; print(get_python_lib())".
                    return (IS_WINDOWS && libPath.length > 0) ? path.join(libPath, '..') : libPath;
                })
                    .catch(() => ''),
                // Python global site packages, as a fallback in case user hasn't installed them in custom environment.
                this.getPathFromPythonCommand(['-m', 'site', '--user-site']).catch(() => '')
            ];
            try {
                const pythonPaths = yield this.getEnvironmentVariablesProvider().getEnvironmentVariables(vscode_1.Uri.file(this.workspacePath))
                    .then(customEnvironmentVars => customEnvironmentVars ? JediProxy.getProperty(customEnvironmentVars, 'PYTHONPATH') : '')
                    .then(pythonPath => (typeof pythonPath === 'string' && pythonPath.trim().length > 0) ? pythonPath.trim() : '')
                    .then(pythonPath => pythonPath.split(path.delimiter).filter(item => item.trim().length > 0));
                const resolvedPaths = pythonPaths
                    .filter(pythonPath => !path.isAbsolute(pythonPath))
                    .map(pythonPath => path.resolve(this.workspacePath, pythonPath));
                const filePaths = yield Promise.all(filePathPromises);
                return filePaths.concat(...pythonPaths, ...resolvedPaths).filter(p => p.length > 0);
            }
            catch (ex) {
                console.error('Python Extension: jediProxy.filePaths', ex);
                return [];
            }
        });
    }
    getEnvironmentVariablesProvider() {
        if (!this.environmentVariablesProvider) {
            this.environmentVariablesProvider = this.serviceContainer.get(types_3.IEnvironmentVariablesProvider);
            this.environmentVariablesProvider.onDidEnvironmentVariablesChange(this.environmentVariablesChangeHandler.bind(this));
        }
        return this.environmentVariablesProvider;
    }
    getConfig() {
        // Add support for paths relative to workspace.
        const extraPaths = this.pythonSettings.autoComplete ?
            this.pythonSettings.autoComplete.extraPaths.map(extraPath => {
                if (path.isAbsolute(extraPath)) {
                    return extraPath;
                }
                if (typeof this.workspacePath !== 'string') {
                    return '';
                }
                return path.join(this.workspacePath, extraPath);
            }) : [];
        // Always add workspace path into extra paths.
        if (typeof this.workspacePath === 'string') {
            extraPaths.unshift(this.workspacePath);
        }
        const distinctExtraPaths = extraPaths.concat(this.additionalAutoCompletePaths)
            .filter(value => value.length > 0)
            .filter((value, index, self) => self.indexOf(value) === index);
        return {
            extraPaths: distinctExtraPaths,
            useSnippets: false,
            caseInsensitiveCompletion: true,
            showDescriptions: true,
            fuzzyMatcher: true
        };
    }
    safeResolve(command, result) {
        if (command && command.deferred) {
            command.deferred.resolve(result);
        }
    }
}
__decorate([
    decorators_1.swallowExceptions('JediProxy')
], JediProxy.prototype, "pythonSettingsChangeHandler", null);
__decorate([
    decorators_1.debounce(1500),
    decorators_1.swallowExceptions('JediProxy')
], JediProxy.prototype, "environmentVariablesChangeHandler", null);
__decorate([
    decorators_1.swallowExceptions('JediProxy')
], JediProxy.prototype, "startLanguageServer", null);
exports.JediProxy = JediProxy;
class JediProxyHandler {
    constructor(jediProxy) {
        this.jediProxy = jediProxy;
        this.commandCancellationTokenSources = new Map();
    }
    get JediProxy() {
        return this.jediProxy;
    }
    dispose() {
        if (this.jediProxy) {
            this.jediProxy.dispose();
        }
    }
    sendCommand(cmd, token) {
        const executionCmd = cmd;
        executionCmd.id = executionCmd.id || this.jediProxy.getNextCommandId();
        if (this.commandCancellationTokenSources.has(cmd.command)) {
            const ct = this.commandCancellationTokenSources.get(cmd.command);
            if (ct) {
                ct.cancel();
            }
        }
        const cancellation = new vscode_1.CancellationTokenSource();
        this.commandCancellationTokenSources.set(cmd.command, cancellation);
        executionCmd.token = cancellation.token;
        return this.jediProxy.sendCommand(executionCmd)
            .catch(reason => {
            console.error(reason);
            return undefined;
        });
    }
    sendCommandNonCancellableCommand(cmd, token) {
        const executionCmd = cmd;
        executionCmd.id = executionCmd.id || this.jediProxy.getNextCommandId();
        if (token) {
            executionCmd.token = token;
        }
        return this.jediProxy.sendCommand(executionCmd)
            .catch(reason => {
            console.error(reason);
            return undefined;
        });
    }
}
exports.JediProxyHandler = JediProxyHandler;
//# sourceMappingURL=jediProxy.js.map