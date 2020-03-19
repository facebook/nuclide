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
const types_1 = require("../common/types");
const types_2 = require("../ioc/types");
const types_3 = require("./types");
let HistoryProvider = class HistoryProvider {
    constructor(serviceContainer, disposables) {
        this.serviceContainer = serviceContainer;
        this.disposables = disposables;
        this.create = () => {
            const result = this.serviceContainer.get(types_3.IHistory);
            const handler = result.closed(this.onHistoryClosed);
            this.disposables.push(result);
            this.disposables.push(handler);
            return result;
        };
        this.onHistoryClosed = (history) => {
            if (this.activeHistory === history) {
                this.activeHistory = undefined;
            }
        };
    }
    get active() {
        if (!this.activeHistory) {
            this.activeHistory = this.create();
        }
        return this.activeHistory;
    }
    set active(history) {
        this.activeHistory = history;
    }
};
HistoryProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer)),
    __param(1, inversify_1.inject(types_1.IDisposableRegistry))
], HistoryProvider);
exports.HistoryProvider = HistoryProvider;
//# sourceMappingURL=historyProvider.js.map