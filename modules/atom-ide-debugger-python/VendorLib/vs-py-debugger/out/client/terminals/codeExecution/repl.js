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
const types_1 = require("../../common/application/types");
const types_2 = require("../../common/platform/types");
const types_3 = require("../../common/terminal/types");
const types_4 = require("../../common/types");
const types_5 = require("../../common/types");
const terminalCodeExecution_1 = require("./terminalCodeExecution");
let ReplProvider = class ReplProvider extends terminalCodeExecution_1.TerminalCodeExecutionProvider {
    constructor(terminalServiceFactory, configurationService, workspace, disposableRegistry, platformService) {
        super(terminalServiceFactory, configurationService, workspace, disposableRegistry, platformService);
        this.terminalTitle = 'REPL';
    }
};
ReplProvider = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_3.ITerminalServiceFactory)),
    __param(1, inversify_1.inject(types_4.IConfigurationService)),
    __param(2, inversify_1.inject(types_1.IWorkspaceService)),
    __param(3, inversify_1.inject(types_5.IDisposableRegistry)),
    __param(4, inversify_1.inject(types_2.IPlatformService))
], ReplProvider);
exports.ReplProvider = ReplProvider;
//# sourceMappingURL=repl.js.map