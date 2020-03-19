// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-any
const inversify_1 = require("inversify");
let CurrentProcess = class CurrentProcess {
    constructor() {
        this.on = (event, listener) => {
            process.on(event, listener);
            return process;
        };
    }
    get env() {
        return process.env;
    }
    get argv() {
        return process.argv;
    }
    get stdout() {
        return process.stdout;
    }
    get stdin() {
        return process.stdin;
    }
    get execPath() {
        return process.execPath;
    }
};
CurrentProcess = __decorate([
    inversify_1.injectable()
], CurrentProcess);
exports.CurrentProcess = CurrentProcess;
//# sourceMappingURL=currentProcess.js.map