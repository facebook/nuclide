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
const inversify_1 = require("inversify");
const TypeMoq = require("typemoq");
let MockProcess = class MockProcess {
    constructor(env = Object.assign({}, process.env)) {
        this.env = env;
    }
    on(event, listener) {
        return this;
    }
    get argv() {
        return [];
    }
    get stdout() {
        return TypeMoq.Mock.ofType().object;
    }
    get stdin() {
        return TypeMoq.Mock.ofType().object;
    }
    get execPath() {
        return '';
    }
};
MockProcess = __decorate([
    inversify_1.injectable()
], MockProcess);
exports.MockProcess = MockProcess;
//# sourceMappingURL=process.js.map