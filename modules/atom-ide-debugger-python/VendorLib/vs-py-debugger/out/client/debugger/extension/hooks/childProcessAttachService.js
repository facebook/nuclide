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
const types_1 = require("../../../common/application/types");
const misc_1 = require("../../../common/utils/misc");
const telemetry_1 = require("../../../telemetry");
const constants_1 = require("../../../telemetry/constants");
/**
 * This class is responsible for attaching the debugger to any
 * child processes launched. I.e. this is the classs responsible for multi-proc debugging.
 * @export
 * @class ChildProcessAttachEventHandler
 * @implements {IChildProcessAttachService}
 */
let ChildProcessAttachService = class ChildProcessAttachService {
    constructor(appShell, debugService, workspaceService) {
        this.appShell = appShell;
        this.debugService = debugService;
        this.workspaceService = workspaceService;
    }
    attach(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const folder = this.getRelatedWorkspaceFolder(data);
            const debugConfig = this.getAttachConfiguration(data);
            const launched = yield this.debugService.startDebugging(folder, debugConfig);
            if (!launched) {
                this.appShell.showErrorMessage(`Failed to launch debugger for child process ${data.processId}`).then(misc_1.noop, misc_1.noop);
            }
        });
    }
    getRelatedWorkspaceFolder(data) {
        const workspaceFolder = data.rootStartRequest.arguments.workspaceFolder;
        if (!this.workspaceService.hasWorkspaceFolders || !workspaceFolder) {
            return;
        }
        return this.workspaceService.workspaceFolders.find(ws => ws.uri.fsPath === workspaceFolder);
    }
    getAttachConfiguration(data) {
        const args = data.rootStartRequest.arguments;
        // tslint:disable-next-line:no-any
        const config = JSON.parse(JSON.stringify(args));
        config.host = args.request === 'attach' ? args.host : 'localhost';
        config.port = data.port;
        config.name = `Child Process ${data.processId}`;
        config.request = 'attach';
        return config;
    }
};
__decorate([
    telemetry_1.captureTelemetry(constants_1.DEBUGGER_ATTACH_TO_CHILD_PROCESS)
], ChildProcessAttachService.prototype, "attach", null);
ChildProcessAttachService = __decorate([
    inversify_1.injectable(),
    __param(0, inversify_1.inject(types_1.IApplicationShell)),
    __param(1, inversify_1.inject(types_1.IDebugService)),
    __param(2, inversify_1.inject(types_1.IWorkspaceService))
], ChildProcessAttachService);
exports.ChildProcessAttachService = ChildProcessAttachService;
//# sourceMappingURL=childProcessAttachService.js.map