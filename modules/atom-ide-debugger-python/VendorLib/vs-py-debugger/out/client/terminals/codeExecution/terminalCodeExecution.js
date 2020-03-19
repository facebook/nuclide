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
const path = require("path");
const types_1 = require("../../common/application/types");
require("../../common/extensions");
const types_2 = require("../../common/platform/types");
const types_3 = require("../../common/terminal/types");
const types_4 = require("../../common/types");
let TerminalCodeExecutionProvider = class TerminalCodeExecutionProvider {
    constructor(terminalServiceFactory, configurationService, workspace, disposables, platformService) {
        this.terminalServiceFactory = terminalServiceFactory;
        this.configurationService = configurationService;
        this.workspace = workspace;
        this.disposables = disposables;
        this.platformService = platformService;
    }
    executeFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonSettings = this.configurationService.getSettings(file);
            yield this.setCwdForFileExecution(file);
            const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
            const launchArgs = pythonSettings.terminal.launchArgs;
            yield this.getTerminalService(file).sendCommand(command, launchArgs.concat(file.fsPath.fileToCommandArgument()));
        });
    }
    execute(code, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!code || code.trim().length === 0) {
                return;
            }
            yield this.initializeRepl();
            yield this.getTerminalService(resource).sendText(code);
        });
    }
    initializeRepl(resource) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.replActive && (yield this.replActive)) {
                yield this._terminalService.show();
                return;
            }
            this.replActive = new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                const replCommandArgs = this.getReplCommandArgs(resource);
                yield this.getTerminalService(resource).sendCommand(replCommandArgs.command, replCommandArgs.args);
                // Give python repl time to start before we start sending text.
                setTimeout(() => resolve(true), 1000);
            }));
            yield this.replActive;
        });
    }
    getReplCommandArgs(resource) {
        const pythonSettings = this.configurationService.getSettings(resource);
        const command = this.platformService.isWindows ? pythonSettings.pythonPath.replace(/\\/g, '/') : pythonSettings.pythonPath;
        const args = pythonSettings.terminal.launchArgs.slice();
        return { command, args };
    }
    getTerminalService(resource) {
        if (!this._terminalService) {
            this._terminalService = this.terminalServiceFactory.getTerminalService(resource, this.terminalTitle);
            this.disposables.push(this._terminalService.onDidCloseTerminal(() => {
                this.replActive = undefined;
            }));
        }
        return this._terminalService;
    }
    setCwdForFileExecution(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonSettings = this.configurationService.getSettings(file);
            if (!pythonSettings.terminal.executeInFileDir) {
                return;
            }
            const fileDirPath = path.dirname(file.fsPath);
            const wkspace = this.workspace.getWorkspaceFolder(file);
            if (wkspace && fileDirPath !== wkspace.uri.fsPath && fileDirPath.length > 0) {
                yield this.getTerminalService(file).sendText(`cd ${fileDirPath.fileToCommandArgument()}`);
            }
        });
    }
};
TerminalCodeExecutionProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.ITerminalServiceFactory)),
    __param(1, inversify_1.inject(types_4.IConfigurationService)),
    __param(2, inversify_1.inject(types_1.IWorkspaceService)),
    __param(3, inversify_1.inject(types_4.IDisposableRegistry)),
    __param(4, inversify_1.inject(types_2.IPlatformService))
], TerminalCodeExecutionProvider);
exports.TerminalCodeExecutionProvider = TerminalCodeExecutionProvider;
//# sourceMappingURL=terminalCodeExecution.js.map