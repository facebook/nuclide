"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RemoteDebugServerv2_1 = require("../DebugServers/RemoteDebugServerv2");
const DebugClient_1 = require("./DebugClient");
class RemoteDebugClient extends DebugClient_1.DebugClient {
    // tslint:disable-next-line:no-any
    constructor(args, debugSession) {
        super(args, debugSession);
    }
    CreateDebugServer() {
        this.debugServer = new RemoteDebugServerv2_1.RemoteDebugServerV2(this.debugSession, this.args);
        return this.debugServer;
    }
    get DebugType() {
        return DebugClient_1.DebugType.Remote;
    }
    Stop() {
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = undefined;
        }
    }
}
exports.RemoteDebugClient = RemoteDebugClient;
//# sourceMappingURL=RemoteDebugClient.js.map