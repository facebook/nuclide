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
const types_1 = require("../../../ioc/types");
const execVSCCommand_1 = require("./execVSCCommand");
const ignore_1 = require("./ignore");
const launchBrowser_1 = require("./launchBrowser");
let DiagnosticsCommandFactory = class DiagnosticsCommandFactory {
    constructor(serviceContainer) {
        this.serviceContainer = serviceContainer;
    }
    createCommand(diagnostic, options) {
        const commandType = options.type;
        switch (options.type) {
            case 'ignore': {
                return new ignore_1.IgnoreDiagnosticCommand(diagnostic, this.serviceContainer, options.options);
            }
            case 'launch': {
                return new launchBrowser_1.LaunchBrowserCommand(diagnostic, this.serviceContainer, options.options);
            }
            case 'executeVSCCommand': {
                return new execVSCCommand_1.ExecuteVSCCommand(diagnostic, this.serviceContainer, options.options);
            }
            default: {
                throw new Error(`Unknown Diagnostic command commandType '${commandType}'`);
            }
        }
    }
};
DiagnosticsCommandFactory = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IServiceContainer))
], DiagnosticsCommandFactory);
exports.DiagnosticsCommandFactory = DiagnosticsCommandFactory;
//# sourceMappingURL=factory.js.map