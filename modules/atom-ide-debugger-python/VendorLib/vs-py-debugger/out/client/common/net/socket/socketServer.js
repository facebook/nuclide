"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const inversify_1 = require("inversify");
const net = require("net");
const async_1 = require("../../utils/async");
const misc_1 = require("../../utils/misc");
let SocketServer = class SocketServer extends events_1.EventEmitter {
    constructor() {
        super();
        this.clientSocket = async_1.createDeferred();
    }
    get client() {
        return this.clientSocket.promise;
    }
    dispose() {
        this.Stop();
    }
    Stop() {
        if (!this.socketServer) {
            return;
        }
        try {
            this.socketServer.close();
            // tslint:disable-next-line:no-empty
        }
        catch (ex) { }
        this.socketServer = undefined;
    }
    Start(options = {}) {
        const def = async_1.createDeferred();
        this.socketServer = net.createServer(this.connectionListener.bind(this));
        const port = typeof options.port === 'number' ? options.port : 0;
        const host = typeof options.host === 'string' ? options.host : 'localhost';
        this.socketServer.on('error', ex => {
            console.error('Error in Socket Server', ex);
            const msg = `Failed to start the socket server. (Error: ${ex.message})`;
            def.reject(msg);
        });
        this.socketServer.listen({ port, host }, () => {
            def.resolve(this.socketServer.address().port);
        });
        return def.promise;
    }
    connectionListener(client) {
        if (!this.clientSocket.completed) {
            this.clientSocket.resolve(client);
        }
        client.on('close', () => {
            this.emit('close', client);
        });
        client.on('data', (data) => {
            this.emit('data', client, data);
        });
        client.on('error', (err) => misc_1.noop);
        client.on('timeout', d => {
            // let msg = "Debugger client timedout, " + d;
        });
    }
};
SocketServer = __decorate([
    inversify_1.injectable()
], SocketServer);
exports.SocketServer = SocketServer;
//# sourceMappingURL=socketServer.js.map