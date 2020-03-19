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
const types_1 = require("../../common/application/types");
const logger_1 = require("../../common/logger");
const types_2 = require("../../common/types");
const async_1 = require("../../common/utils/async");
const localize_1 = require("../../common/utils/localize");
const contracts_1 = require("../contracts");
let InterpreterLocatorProgressStatubarHandler = class InterpreterLocatorProgressStatubarHandler {
    constructor(shell, progressService, disposables) {
        this.shell = shell;
        this.progressService = progressService;
        this.disposables = disposables;
        this.isFirstTimeLoadingInterpreters = true;
    }
    register() {
        this.progressService.onRefreshing(() => this.showProgress(), this, this.disposables);
        this.progressService.onRefreshed(() => this.hideProgress(), this, this.disposables);
    }
    showProgress() {
        if (!this.deferred) {
            this.createProgress();
        }
    }
    hideProgress() {
        if (this.deferred) {
            this.deferred.resolve();
            this.deferred = undefined;
        }
    }
    createProgress() {
        const progressOptions = {
            location: vscode_1.ProgressLocation.Window,
            title: this.isFirstTimeLoadingInterpreters ? localize_1.Interpreters.loading() : localize_1.Interpreters.refreshing()
        };
        this.isFirstTimeLoadingInterpreters = false;
        this.shell.withProgress(progressOptions, () => {
            this.deferred = async_1.createDeferred();
            return this.deferred.promise;
        });
    }
};
__decorate([
    logger_1.traceVerbose('Display locator refreshing progress')
], InterpreterLocatorProgressStatubarHandler.prototype, "showProgress", null);
__decorate([
    logger_1.traceVerbose('Hide locator refreshing progress')
], InterpreterLocatorProgressStatubarHandler.prototype, "hideProgress", null);
InterpreterLocatorProgressStatubarHandler = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IApplicationShell)),
    __param(1, inversify_1.inject(contracts_1.IInterpreterLocatorProgressService)),
    __param(2, inversify_1.inject(types_2.IDisposableRegistry))
], InterpreterLocatorProgressStatubarHandler);
exports.InterpreterLocatorProgressStatubarHandler = InterpreterLocatorProgressStatubarHandler;
//# sourceMappingURL=progressDisplay.js.map