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
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const types_1 = require("../../../common/application/types");
const types_2 = require("../../../common/types");
const types_3 = require("./types");
let DebugSessionEventDispatcher = class DebugSessionEventDispatcher {
    constructor(eventHandlers, debugService, disposables) {
        this.eventHandlers = eventHandlers;
        this.debugService = debugService;
        this.disposables = disposables;
    }
    registerEventHandlers() {
        this.disposables.push(this.debugService.onDidReceiveDebugSessionCustomEvent(e => {
            this.eventHandlers.forEach(handler => handler.handleCustomEvent ? handler.handleCustomEvent(e).ignoreErrors() : undefined);
        }));
        this.disposables.push(this.debugService.onDidTerminateDebugSession(e => {
            this.eventHandlers.forEach(handler => handler.handleTerminateEvent ? handler.handleTerminateEvent(e).ignoreErrors() : undefined);
        }));
    }
};
DebugSessionEventDispatcher = __decorate([
    __param(0, inversify_1.multiInject(types_3.IDebugSessionEventHandlers)),
    __param(1, inversify_1.inject(types_1.IDebugService)),
    __param(2, inversify_1.inject(types_2.IDisposableRegistry))
], DebugSessionEventDispatcher);
exports.DebugSessionEventDispatcher = DebugSessionEventDispatcher;
//# sourceMappingURL=eventHandlerDispatcher.js.map