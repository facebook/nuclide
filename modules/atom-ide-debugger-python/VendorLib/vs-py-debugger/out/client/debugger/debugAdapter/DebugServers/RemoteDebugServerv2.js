// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const BaseDebugServer_1 = require("./BaseDebugServer");
class RemoteDebugServerV2 extends BaseDebugServer_1.BaseDebugServer {
    constructor(debugSession, args) {
        super(debugSession);
        this.args = args;
    }
    Stop() {
        if (this.socket) {
            this.socket.destroy();
        }
    }
    Start() {
        return new Promise((resolve, reject) => {
            const port = this.args.port;
            const options = { port };
            if (typeof this.args.host === 'string' && this.args.host.length > 0) {
                // tslint:disable-next-line:no-any
                options.host = this.args.host;
            }
            try {
                let connected = false;
                const socket = new net_1.Socket();
                socket.on('error', ex => {
                    if (connected) {
                        return;
                    }
                    reject(ex);
                });
                socket.connect(options, () => {
                    connected = true;
                    this.socket = socket;
                    this.clientSocket.resolve(socket);
                    resolve(options);
                });
            }
            catch (ex) {
                reject(ex);
            }
        });
    }
}
exports.RemoteDebugServerV2 = RemoteDebugServerV2;
//# sourceMappingURL=RemoteDebugServerv2.js.map