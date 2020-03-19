"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const vscode_1 = require("vscode");
require("../../common/extensions");
const contracts_1 = require("../../interpreter/contracts");
const types_1 = require("../../ioc/types");
const telemetry_1 = require("../../telemetry");
const constants_1 = require("../../telemetry/constants");
const types_2 = require("../application/types");
const types_3 = require("../types");
const types_4 = require("./types");
let TerminalService = class TerminalService {
    constructor(serviceContainer, resource, title = 'Python') {
        this.serviceContainer = serviceContainer;
        this.resource = resource;
        this.title = title;
        this.terminalClosed = new vscode_1.EventEmitter();
        const disposableRegistry = this.serviceContainer.get(types_3.IDisposableRegistry);
        disposableRegistry.push(this);
        this.terminalHelper = this.serviceContainer.get(types_4.ITerminalHelper);
        this.terminalManager = this.serviceContainer.get(types_2.ITerminalManager);
        this.terminalManager.onDidCloseTerminal(this.terminalCloseHandler, this, disposableRegistry);
        this.terminalActivator = this.serviceContainer.get(types_4.ITerminalActivator);
    }
    get onDidCloseTerminal() {
        return this.terminalClosed.event.bind(this.terminalClosed);
    }
    dispose() {
        if (this.terminal) {
            this.terminal.dispose();
        }
    }
    sendCommand(command, args) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTerminal();
            const text = this.terminalHelper.buildCommandForTerminal(this.terminalShellType, command, args);
            this.terminal.show(true);
            this.terminal.sendText(text, true);
        });
    }
    sendText(text) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTerminal();
            this.terminal.show(true);
            this.terminal.sendText(text);
        });
    }
    show(preserveFocus = true) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTerminal(preserveFocus);
            this.terminal.show(preserveFocus);
        });
    }
    ensureTerminal(preserveFocus = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.terminal) {
                return;
            }
            const shellPath = this.terminalHelper.getTerminalShellPath();
            this.terminalShellType = !shellPath || shellPath.length === 0 ? types_4.TerminalShellType.other : this.terminalHelper.identifyTerminalShell(shellPath);
            this.terminal = this.terminalManager.createTerminal({ name: this.title });
            // Sometimes the terminal takes some time to start up before it can start accepting input.
            yield new Promise(resolve => setTimeout(resolve, 100));
            yield this.terminalActivator.activateEnvironmentInTerminal(this.terminal, this.resource, preserveFocus);
            this.terminal.show(preserveFocus);
            this.sendTelemetry().ignoreErrors();
        });
    }
    terminalCloseHandler(terminal) {
        if (terminal === this.terminal) {
            this.terminalClosed.fire();
            this.terminal = undefined;
        }
    }
    sendTelemetry() {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonPath = this.serviceContainer.get(types_3.IConfigurationService).getSettings(this.resource).pythonPath;
            const interpreterInfo = yield this.serviceContainer.get(contracts_1.IInterpreterService).getInterpreterDetails(pythonPath);
            const pythonVersion = (interpreterInfo && interpreterInfo.version_info) ? interpreterInfo.version_info.join('.') : undefined;
            const interpreterType = interpreterInfo ? interpreterInfo.type : undefined;
            telemetry_1.captureTelemetry(constants_1.TERMINAL_CREATE, { terminal: this.terminalShellType, pythonVersion, interpreterType });
        });
    }
};
TerminalService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], TerminalService);
exports.TerminalService = TerminalService;
//# sourceMappingURL=service.js.map