"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var DebugService_1;
'use strict';
const inversify_1 = require("inversify");
const vscode_1 = require("vscode");
let DebugService = DebugService_1 = class DebugService {
    get activeDebugConsole() {
        return vscode_1.debug.activeDebugConsole;
    }
    get activeDebugSession() {
        return vscode_1.debug.activeDebugSession;
    }
    get breakpoints() {
        return vscode_1.debug.breakpoints;
    }
    get onDidChangeActiveDebugSession() {
        return vscode_1.debug.onDidChangeActiveDebugSession;
    }
    get onDidStartDebugSession() {
        return vscode_1.debug.onDidStartDebugSession;
    }
    get onDidReceiveDebugSessionCustomEvent() {
        return vscode_1.debug.onDidReceiveDebugSessionCustomEvent;
    }
    get onDidTerminateDebugSession() {
        return vscode_1.debug.onDidTerminateDebugSession;
    }
    get onDidChangeBreakpoints() {
        return vscode_1.debug.onDidChangeBreakpoints;
    }
    // tslint:disable-next-line:no-any
    registerDebugConfigurationProvider(debugType, provider) {
        return vscode_1.debug.registerDebugConfigurationProvider(debugType, provider);
    }
    startDebugging(folder, nameOrConfiguration) {
        return vscode_1.debug.startDebugging(folder, nameOrConfiguration);
    }
    addBreakpoints(breakpoints) {
        vscode_1.debug.addBreakpoints(breakpoints);
    }
    removeBreakpoints(breakpoints) {
        vscode_1.debug.removeBreakpoints(breakpoints);
    }
};
DebugService.instance = new DebugService_1();
DebugService = DebugService_1 = __decorate([
    inversify_1.injectable()
], DebugService);
exports.DebugService = DebugService;
//# sourceMappingURL=debugService.js.map