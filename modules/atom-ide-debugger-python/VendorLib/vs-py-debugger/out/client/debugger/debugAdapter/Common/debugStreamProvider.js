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
const net_1 = require("net");
const constants_1 = require("../../../common/constants");
const types_1 = require("../../../common/types");
const types_2 = require("../../../ioc/types");
let DebugStreamProvider = class DebugStreamProvider {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    get useDebugSocketStream() {
        return this.getDebugPort() > 0;
    }
    getInputAndOutputStreams() {
        return __awaiter(this, void 0, void 0, function* () {
            const debugPort = this.getDebugPort();
            let debugSocket;
            if (debugPort > 0) {
                // This section is what allows VS Code extension developers to attach to the current debugger.
                // Used in scenarios where extension developers would like to debug the debugger.
                debugSocket = new Promise(resolve => {
                    // start as a server, and print to console in VS Code debugger for extension developer.
                    // Do not print this out when running unit tests.
                    if (!constants_1.isTestExecution()) {
                        console.error(`waiting for debug protocol on port ${debugPort}`);
                    }
                    net_1.createServer((socket) => {
                        if (!constants_1.isTestExecution()) {
                            console.error('>> accepted connection from client');
                        }
                        resolve(socket);
                    }).listen(debugPort);
                });
            }
            const currentProcess = this.serviceContainer.get(types_1.ICurrentProcess);
            const input = debugSocket ? yield debugSocket : currentProcess.stdin;
            const output = debugSocket ? yield debugSocket : currentProcess.stdout;
            return { input, output };
        });
    }
    getDebugPort() {
        const currentProcess = this.serviceContainer.get(types_1.ICurrentProcess);
        let debugPort = 0;
        const args = currentProcess.argv.slice(2);
        args.forEach((val, index, array) => {
            const portMatch = /^--server=(\d{4,5})$/.exec(val);
            if (portMatch) {
                debugPort = parseInt(portMatch[1], 10);
            }
        });
        return debugPort;
    }
};
DebugStreamProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_2.IServiceContainer))
], DebugStreamProvider);
exports.DebugStreamProvider = DebugStreamProvider;
//# sourceMappingURL=debugStreamProvider.js.map