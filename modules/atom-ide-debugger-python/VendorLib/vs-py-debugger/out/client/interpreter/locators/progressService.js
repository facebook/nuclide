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
const vscode_1 = require("vscode");
const logger_1 = require("../../common/logger");
const types_1 = require("../../common/types");
const async_1 = require("../../common/utils/async");
const misc_1 = require("../../common/utils/misc");
const types_2 = require("../../ioc/types");
const contracts_1 = require("../contracts");
let InterpreterLocatorProgressService = class InterpreterLocatorProgressService {
    constructor(serviceContainer, disposables) {
        this.disposables = disposables;
        this.deferreds = [];
        this.refreshing = new vscode_1.EventEmitter();
        this.refreshed = new vscode_1.EventEmitter();
        this.locators = [];
        this.locators = serviceContainer.getAll(contracts_1.IInterpreterLocatorService);
    }
    get onRefreshing() {
        return this.refreshing.event;
    }
    get onRefreshed() {
        return this.refreshed.event;
    }
    register() {
        this.locators.forEach(locator => {
            locator.onLocating(this.handleProgress, this, this.disposables);
        });
    }
    handleProgress(promise) {
        this.deferreds.push(async_1.createDeferredFrom(promise));
        this.notifyRefreshing();
        this.checkProgress();
    }
    notifyCompleted() {
        this.refreshed.fire();
    }
    notifyRefreshing() {
        this.refreshing.fire();
    }
    checkProgress() {
        if (this.areAllItemsCcomplete()) {
            return this.notifyCompleted();
        }
        Promise.all(this.deferreds.map(item => item.promise))
            .catch(misc_1.noop)
            .then(() => this.checkProgress())
            .ignoreErrors();
    }
    areAllItemsCcomplete() {
        this.deferreds = this.deferreds.filter(item => !item.completed);
        return this.deferreds.length === 0;
    }
};
__decorate([
    logger_1.traceVerbose('Detected refreshing of Interpreters')
], InterpreterLocatorProgressService.prototype, "handleProgress", null);
__decorate([
    logger_1.traceVerbose('All locators have completed locating')
], InterpreterLocatorProgressService.prototype, "notifyCompleted", null);
__decorate([
    logger_1.traceVerbose('Notify locators are locating')
], InterpreterLocatorProgressService.prototype, "notifyRefreshing", null);
__decorate([
    logger_1.traceVerbose('Checking whether locactors have completed locating')
], InterpreterLocatorProgressService.prototype, "checkProgress", null);
InterpreterLocatorProgressService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer)),
    __param(1, inversify_1.inject(types_1.IDisposableRegistry))
], InterpreterLocatorProgressService);
exports.InterpreterLocatorProgressService = InterpreterLocatorProgressService;
//# sourceMappingURL=progressService.js.map