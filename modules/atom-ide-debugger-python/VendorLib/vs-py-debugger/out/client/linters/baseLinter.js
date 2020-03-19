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
const path = require("path");
const types_1 = require("../common/application/types");
require("../common/extensions");
const types_2 = require("../common/process/types");
const types_3 = require("../common/types");
const errorHandler_1 = require("./errorHandlers/errorHandler");
const types_4 = require("./types");
// tslint:disable-next-line:no-require-imports no-var-requires
const namedRegexp = require('named-js-regexp');
// Allow negative column numbers (https://github.com/PyCQA/pylint/issues/1822)
const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>\\w\\d+):(?<message>.*)\\r?(\\n|$)';
function matchNamedRegEx(data, regex) {
    const compiledRegexp = namedRegexp(regex, 'g');
    const rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return rawMatch.groups();
    }
    return undefined;
}
exports.matchNamedRegEx = matchNamedRegEx;
function parseLine(line, regex, linterID, colOffset = 0) {
    const match = matchNamedRegEx(line, regex);
    if (!match) {
        return;
    }
    // tslint:disable-next-line:no-any
    match.line = Number(match.line);
    // tslint:disable-next-line:no-any
    match.column = Number(match.column);
    return {
        code: match.code,
        message: match.message,
        column: isNaN(match.column) || match.column <= 0 ? 0 : match.column - colOffset,
        line: match.line,
        type: match.type,
        provider: linterID
    };
}
exports.parseLine = parseLine;
class BaseLinter {
    constructor(product, outputChannel, serviceContainer, columnOffset = 0) {
        this.outputChannel = outputChannel;
        this.serviceContainer = serviceContainer;
        this.columnOffset = columnOffset;
        this._info = serviceContainer.get(types_4.ILinterManager).getLinterInfo(product);
        this.errorHandler = new errorHandler_1.ErrorHandler(this.info.product, outputChannel, serviceContainer);
        this.configService = serviceContainer.get(types_3.IConfigurationService);
        this.workspace = serviceContainer.get(types_1.IWorkspaceService);
    }
    get pythonSettings() {
        return this._pythonSettings;
    }
    get info() {
        return this._info;
    }
    lint(document, cancellation) {
        return __awaiter(this, void 0, void 0, function* () {
            this._pythonSettings = this.configService.getSettings(document.uri);
            return this.runLinter(document, cancellation);
        });
    }
    getWorkspaceRootPath(document) {
        const workspaceFolder = this.workspace.getWorkspaceFolder(document.uri);
        const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined;
        return typeof workspaceRootPath === 'string' ? workspaceRootPath : path.dirname(document.uri.fsPath);
    }
    get logger() {
        return this.serviceContainer.get(types_3.ILogger);
    }
    // tslint:disable-next-line:no-any
    parseMessagesSeverity(error, categorySeverity) {
        if (categorySeverity[error]) {
            const severityName = categorySeverity[error];
            switch (severityName) {
                case 'Error':
                    return types_4.LintMessageSeverity.Error;
                case 'Hint':
                    return types_4.LintMessageSeverity.Hint;
                case 'Information':
                    return types_4.LintMessageSeverity.Information;
                case 'Warning':
                    return types_4.LintMessageSeverity.Warning;
                default: {
                    if (types_4.LintMessageSeverity[severityName]) {
                        // tslint:disable-next-line:no-any
                        return types_4.LintMessageSeverity[severityName];
                    }
                }
            }
        }
        return types_4.LintMessageSeverity.Information;
    }
    run(args, document, cancellation, regEx = REGEX) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.info.isEnabled(document.uri)) {
                return [];
            }
            const executionInfo = this.info.getExecutionInfo(args, document.uri);
            const cwd = this.getWorkspaceRootPath(document);
            const pythonToolsExecutionService = this.serviceContainer.get(types_2.IPythonToolExecutionService);
            try {
                const result = yield pythonToolsExecutionService.exec(executionInfo, { cwd, token: cancellation, mergeStdOutErr: false }, document.uri);
                this.displayLinterResultHeader(result.stdout);
                return yield this.parseMessages(result.stdout, document, cancellation, regEx);
            }
            catch (error) {
                this.handleError(error, document.uri, executionInfo);
                return [];
            }
        });
    }
    parseMessages(output, document, token, regEx) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputLines = output.splitLines({ removeEmptyEntries: false, trim: false });
            return this.parseLines(outputLines, regEx);
        });
    }
    handleError(error, resource, execInfo) {
        this.errorHandler.handleError(error, resource, execInfo)
            .catch(this.logger.logError.bind(this, 'Error in errorHandler.handleError'));
    }
    parseLine(line, regEx) {
        return parseLine(line, regEx, this.info.id, this.columnOffset);
    }
    parseLines(outputLines, regEx) {
        const messages = [];
        for (const line of outputLines) {
            try {
                const msg = this.parseLine(line, regEx);
                if (msg) {
                    messages.push(msg);
                    if (messages.length >= this.pythonSettings.linting.maxNumberOfProblems) {
                        break;
                    }
                }
            }
            catch (ex) {
                this.logger.logError(`Linter '${this.info.id}' failed to parse the line '${line}.`, ex);
            }
        }
        return messages;
    }
    displayLinterResultHeader(data) {
        this.outputChannel.append(`${'#'.repeat(10)}Linting Output - ${this.info.id}${'#'.repeat(10)}\n`);
        this.outputChannel.append(data);
    }
}
exports.BaseLinter = BaseLinter;
//# sourceMappingURL=baseLinter.js.map