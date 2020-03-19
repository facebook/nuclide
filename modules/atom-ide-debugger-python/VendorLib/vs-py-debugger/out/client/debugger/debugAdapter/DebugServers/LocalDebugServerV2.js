// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../../../common/types");
const async_1 = require("../../../common/utils/async");
const BaseDebugServer_1 = require("./BaseDebugServer");
class LocalDebugServerV2 extends BaseDebugServer_1.BaseDebugServer {
    constructor(debugSession, args, serviceContainer) {
        super(debugSession);
        this.args = args;
        this.serviceContainer = serviceContainer;
        this.clientSocket = async_1.createDeferred();
    }
    Stop() {
        if (this.socketServer) {
            try {
                this.socketServer.dispose();
                // tslint:disable-next-line:no-empty
            }
            catch (_a) { }
            this.socketServer = undefined;
        }
    }
    Start() {
        return __awaiter(this, void 0, void 0, function* () {
            const host = typeof this.args.host === 'string' && this.args.host.trim().length > 0 ? this.args.host.trim() : 'localhost';
            const socketServer = this.socketServer = this.serviceContainer.get(types_1.ISocketServer);
            const port = yield socketServer.Start({ port: this.args.port, host });
            socketServer.client.then(socket => {
                // This is required to prevent the launcher from aborting if the PTVSD process spits out any errors in stderr stream.
                this.isRunning = true;
                this.debugClientConnected.resolve(true);
                this.clientSocket.resolve(socket);
            }).catch(ex => {
                this.debugClientConnected.reject(ex);
                this.clientSocket.reject(ex);
            });
            return { port, host };
        });
    }
}
exports.LocalDebugServerV2 = LocalDebugServerV2;
//# sourceMappingURL=LocalDebugServerV2.js.map