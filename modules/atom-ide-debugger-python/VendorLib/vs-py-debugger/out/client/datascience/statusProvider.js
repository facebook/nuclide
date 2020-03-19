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
const types_1 = require("../common/application/types");
const async_1 = require("../common/utils/async");
const constants_1 = require("./constants");
class StatusItem {
    constructor(title, history, timeout) {
        this.disposed = false;
        this.dispose = () => {
            if (!this.disposed) {
                this.disposed = true;
                if (this.history !== null) {
                    this.history.postMessage(constants_1.HistoryMessages.StopProgress);
                }
                this.deferred.resolve();
            }
        };
        this.promise = () => {
            return this.deferred.promise;
        };
        this.history = history;
        this.deferred = async_1.createDeferred();
        if (this.history !== null) {
            this.history.postMessage(constants_1.HistoryMessages.StartProgress, title);
        }
        // A timeout is possible too. Auto dispose if that's the case
        if (timeout) {
            setTimeout(this.dispose, timeout);
        }
    }
}
let StatusProvider = class StatusProvider {
    constructor(applicationShell) {
        this.applicationShell = applicationShell;
    }
    set(message, history, timeout) {
        // Create a StatusItem that will return our promise
        const statusItem = new StatusItem(message, history, timeout);
        const progressOptions = {
            location: vscode_1.ProgressLocation.Window,
            title: message
        };
        // Set our application shell status with a busy icon
        this.applicationShell.withProgress(progressOptions, () => { return statusItem.promise(); });
        return statusItem;
    }
};
StatusProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IApplicationShell))
], StatusProvider);
exports.StatusProvider = StatusProvider;
//# sourceMappingURL=statusProvider.js.map