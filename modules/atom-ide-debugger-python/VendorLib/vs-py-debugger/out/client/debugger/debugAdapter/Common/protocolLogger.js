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
const inversify_1 = require("inversify");
let ProtocolLogger = class ProtocolLogger {
    constructor() {
        this.messagesToLog = [];
        this.fromDataCallbackHandler = (data) => {
            this.logMessages(['From Client:', data.toString('utf8')]);
        };
        this.toDataCallbackHandler = (data) => {
            this.logMessages(['To Client:', data.toString('utf8')]);
        };
    }
    dispose() {
        if (this.inputStream) {
            this.inputStream.removeListener('data', this.fromDataCallbackHandler);
            this.outputStream.removeListener('data', this.toDataCallbackHandler);
            this.messagesToLog = [];
            this.inputStream = undefined;
            this.outputStream = undefined;
        }
    }
    connect(inputStream, outputStream) {
        this.inputStream = inputStream;
        this.outputStream = outputStream;
        inputStream.addListener('data', this.fromDataCallbackHandler);
        outputStream.addListener('data', this.toDataCallbackHandler);
    }
    setup(logger) {
        this.logger = logger;
        this.logMessages([`Started @ ${new Date().toString()}`]);
        this.logMessages(this.messagesToLog);
        this.messagesToLog = [];
    }
    logMessages(messages) {
        if (this.logger) {
            messages.forEach(message => this.logger.verbose(`${message}`));
        }
        else {
            this.messagesToLog.push(...messages);
        }
    }
};
ProtocolLogger = __decorate([
    inversify_1.injectable()
], ProtocolLogger);
exports.ProtocolLogger = ProtocolLogger;
//# sourceMappingURL=protocolLogger.js.map