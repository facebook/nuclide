"use strict";
// tslint:disable:no-any no-empty member-ordering prefer-const prefer-template no-var-self
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
const vscode_1 = require("vscode");
require("../common/extensions");
const types_1 = require("../common/process/types");
const util_1 = require("../common/util");
const async_1 = require("../common/utils/async");
const text_1 = require("../common/utils/text");
class RefactorProxy extends vscode_1.Disposable {
    constructor(extensionDir, pythonSettings, workspaceRoot, serviceContainer) {
        super(() => { });
        this.pythonSettings = pythonSettings;
        this.workspaceRoot = workspaceRoot;
        this.serviceContainer = serviceContainer;
        this._previousOutData = '';
        this._previousStdErrData = '';
        this._startedSuccessfully = false;
        this._extensionDir = extensionDir;
    }
    dispose() {
        try {
            this._process.kill();
        }
        catch (ex) {
        }
        this._process = undefined;
    }
    getOffsetAt(document, position) {
        if (!util_1.IS_WINDOWS) {
            return document.offsetAt(position);
        }
        // get line count
        // Rope always uses LF, instead of CRLF on windows, funny isn't it
        // So for each line, reduce one characer (for CR)
        // But Not all Windows users use CRLF
        const offset = document.offsetAt(position);
        const winEols = text_1.getWindowsLineEndingCount(document, offset);
        return offset - winEols;
    }
    rename(document, name, filePath, range, options) {
        if (!options) {
            options = vscode_1.window.activeTextEditor.options;
        }
        const command = {
            lookup: 'rename',
            file: filePath,
            start: this.getOffsetAt(document, range.start).toString(),
            id: '1',
            name: name,
            indent_size: options.tabSize
        };
        return this.sendCommand(JSON.stringify(command));
    }
    extractVariable(document, name, filePath, range, options) {
        if (!options) {
            options = vscode_1.window.activeTextEditor.options;
        }
        const command = {
            lookup: 'extract_variable',
            file: filePath,
            start: this.getOffsetAt(document, range.start).toString(),
            end: this.getOffsetAt(document, range.end).toString(),
            id: '1',
            name: name,
            indent_size: options.tabSize
        };
        return this.sendCommand(JSON.stringify(command));
    }
    extractMethod(document, name, filePath, range, options) {
        if (!options) {
            options = vscode_1.window.activeTextEditor.options;
        }
        // Ensure last line is an empty line
        if (!document.lineAt(document.lineCount - 1).isEmptyOrWhitespace && range.start.line === document.lineCount - 1) {
            return Promise.reject('Missing blank line at the end of document (PEP8).');
        }
        const command = {
            lookup: 'extract_method',
            file: filePath,
            start: this.getOffsetAt(document, range.start).toString(),
            end: this.getOffsetAt(document, range.end).toString(),
            id: '1',
            name: name,
            indent_size: options.tabSize
        };
        return this.sendCommand(JSON.stringify(command));
    }
    sendCommand(command, telemetryEvent) {
        return this.initialize(this.pythonSettings.pythonPath).then(() => {
            // tslint:disable-next-line:promise-must-complete
            return new Promise((resolve, reject) => {
                this._commandResolve = resolve;
                this._commandReject = reject;
                this._process.stdin.write(command + '\n');
            });
        });
    }
    initialize(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonProc = yield this.serviceContainer.get(types_1.IPythonExecutionFactory).create({ resource: vscode_1.Uri.file(this.workspaceRoot) });
            this.initialized = async_1.createDeferred();
            const args = ['refactor.py', this.workspaceRoot];
            const cwd = path.join(this._extensionDir, 'pythonFiles');
            const result = pythonProc.execObservable(args, { cwd });
            this._process = result.proc;
            result.out.subscribe(output => {
                if (output.source === 'stdout') {
                    if (!this._startedSuccessfully && output.out.startsWith('STARTED')) {
                        this._startedSuccessfully = true;
                        return this.initialized.resolve();
                    }
                    this.onData(output.out);
                }
                else {
                    this.handleStdError(output.out);
                }
            }, error => this.handleError(error));
            return this.initialized.promise;
        });
    }
    handleStdError(data) {
        // Possible there was an exception in parsing the data returned
        // So append the data then parse it
        let dataStr = this._previousStdErrData = this._previousStdErrData + data + '';
        let errorResponse;
        try {
            errorResponse = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            this._previousStdErrData = '';
        }
        catch (ex) {
            console.error(ex);
            // Possible we've only received part of the data, hence don't clear previousData
            return;
        }
        if (typeof errorResponse[0].message !== 'string' || errorResponse[0].message.length === 0) {
            errorResponse[0].message = errorResponse[0].traceback.splitLines().pop();
        }
        let errorMessage = errorResponse[0].message + '\n' + errorResponse[0].traceback;
        if (this._startedSuccessfully) {
            this._commandReject(`Refactor failed. ${errorMessage}`);
        }
        else {
            if (typeof errorResponse[0].type === 'string' && errorResponse[0].type === 'ModuleNotFoundError') {
                this.initialized.reject('Not installed');
                return;
            }
            this.initialized.reject(`Refactor failed. ${errorMessage}`);
        }
    }
    handleError(error) {
        if (this._startedSuccessfully) {
            return this._commandReject(error);
        }
        this.initialized.reject(error);
    }
    onData(data) {
        if (!this._commandResolve) {
            return;
        }
        // Possible there was an exception in parsing the data returned
        // So append the data then parse it
        let dataStr = this._previousOutData = this._previousOutData + data + '';
        let response;
        try {
            response = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            this._previousOutData = '';
        }
        catch (ex) {
            // Possible we've only received part of the data, hence don't clear previousData
            return;
        }
        this.dispose();
        this._commandResolve(response[0]);
        this._commandResolve = undefined;
    }
}
exports.RefactorProxy = RefactorProxy;
//# sourceMappingURL=proxy.js.map