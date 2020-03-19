'use strict';
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
const async_1 = require("../../common/utils/async");
// tslint:disable-next-line:variable-name
const MaxConnections = 100;
let UnitTestSocketServer = class UnitTestSocketServer extends events_1.EventEmitter {
    constructor() {
        super();
        this.sockets = [];
        this.ipcBuffer = '';
    }
    get clientsConnected() {
        return this.sockets.length > 0;
    }
    dispose() {
        this.stop();
    }
    stop() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }
    start(options = { port: 0, host: 'localhost' }) {
        this.ipcBuffer = '';
        this.startedDef = async_1.createDeferred();
        this.server = net.createServer(this.connectionListener.bind(this));
        this.server.maxConnections = MaxConnections;
        this.server.on('error', (err) => {
            if (this.startedDef) {
                this.startedDef.reject(err);
                this.startedDef = undefined;
            }
            this.emit('error', err);
        });
        this.log('starting server as', 'TCP');
        options.port = typeof options.port === 'number' ? options.port : 0;
        options.host = typeof options.host === 'string' && options.host.trim().length > 0 ? options.host.trim() : 'localhost';
        this.server.listen(options, (socket) => {
            this.startedDef.resolve(this.server.address().port);
            this.startedDef = undefined;
            this.emit('start', socket);
        });
        return this.startedDef.promise;
    }
    connectionListener(socket) {
        this.sockets.push(socket);
        socket.setEncoding('utf8');
        this.log('## socket connection to server detected ##');
        socket.on('close', () => {
            this.ipcBuffer = '';
            this.onCloseSocket();
        });
        socket.on('error', (err) => {
            this.log('server socket error', err);
            this.emit('error', err);
        });
        socket.on('data', (data) => {
            const sock = socket;
            // Assume we have just one client socket connection
            let dataStr = this.ipcBuffer += data;
            // tslint:disable-next-line:no-constant-condition
            while (true) {
                const startIndex = dataStr.indexOf('{');
                if (startIndex === -1) {
                    return;
                }
                const lengthOfMessage = parseInt(dataStr.slice(dataStr.indexOf(':') + 1, dataStr.indexOf('{')).trim(), 10);
                if (dataStr.length < startIndex + lengthOfMessage) {
                    return;
                }
                // tslint:disable-next-line:no-any
                let message;
                try {
                    message = JSON.parse(dataStr.substring(startIndex, lengthOfMessage + startIndex));
                }
                catch (jsonErr) {
                    this.emit('error', jsonErr);
                    return;
                }
                dataStr = this.ipcBuffer = dataStr.substring(startIndex + lengthOfMessage);
                this.emit(message.event, message.body, sock);
            }
        });
        this.emit('connect', socket);
    }
    log(message, ...data) {
        this.emit('log', message, ...data);
    }
    onCloseSocket() {
        // tslint:disable-next-line:one-variable-per-declaration
        for (let i = 0, count = this.sockets.length; i < count; i += 1) {
            const socket = this.sockets[i];
            let destroyedSocketId = false;
            if (socket && socket.readable) {
                continue;
            }
            // tslint:disable-next-line:no-any prefer-type-cast
            if (socket.id) {
                // tslint:disable-next-line:no-any prefer-type-cast
                destroyedSocketId = socket.id;
            }
            this.log('socket disconnected', destroyedSocketId.toString());
            if (socket && socket.destroy) {
                socket.destroy();
            }
            this.sockets.splice(i, 1);
            this.emit('socket.disconnected', socket, destroyedSocketId);
            return;
        }
    }
};
UnitTestSocketServer = __decorate([
    inversify_1.injectable()
], UnitTestSocketServer);
exports.UnitTestSocketServer = UnitTestSocketServer;
//# sourceMappingURL=socketServer.js.map