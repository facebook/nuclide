"use strict";
// tslint:disable:no-any max-classes-per-file max-func-body-length no-stateless-class no-require-imports no-var-requires no-empty
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const getFreePort = require("get-port");
const net = require("net");
const socketCallbackHandler_1 = require("../../client/common/net/socket/socketCallbackHandler");
const socketServer_1 = require("../../client/common/net/socket/socketServer");
const SocketStream_1 = require("../../client/common/net/socket/SocketStream");
const async_1 = require("../../client/common/utils/async");
const uint64be = require('uint64be');
// tslint:disable-next-line:no-unnecessary-class
class Commands {
}
Commands.ExitCommandBytes = new Buffer('exit');
Commands.PingBytes = new Buffer('ping');
var ResponseCommands;
(function (ResponseCommands) {
    ResponseCommands.Pong = 'PONG';
    ResponseCommands.ListKernels = 'LSTK';
    ResponseCommands.Error = 'EROR';
})(ResponseCommands || (ResponseCommands = {}));
const GUID = 'This is the Guid';
const PID = 1234;
class MockSocketCallbackHandler extends socketCallbackHandler_1.SocketCallbackHandler {
    constructor(socketServer) {
        super(socketServer);
        this.registerCommandHandler(ResponseCommands.Pong, this.onPong.bind(this));
        this.registerCommandHandler(ResponseCommands.Error, this.onError.bind(this));
    }
    ping(message) {
        this.SendRawCommand(Commands.PingBytes);
        const stringBuffer = new Buffer(message);
        const buffer = Buffer.concat([Buffer.concat([new Buffer('U'), uint64be.encode(stringBuffer.byteLength)]), stringBuffer]);
        this.stream.Write(buffer);
    }
    handleHandshake() {
        if (!this.guid) {
            this.guid = this.stream.readStringInTransaction();
            if (typeof this.guid !== 'string') {
                return false;
            }
        }
        if (!this.pid) {
            this.pid = this.stream.readInt32InTransaction();
            if (typeof this.pid !== 'number') {
                return false;
            }
        }
        if (this.guid !== GUID) {
            this.emit('error', this.guid, GUID, 'Guids not the same');
            return true;
        }
        if (this.pid !== PID) {
            this.emit('error', this.pid, PID, 'pids not the same');
            return true;
        }
        this.emit('handshake');
        return true;
    }
    onError() {
        const message = this.stream.readStringInTransaction();
        if (typeof message !== 'string') {
            return;
        }
        this.emit('error', '', '', message);
    }
    onPong() {
        const message = this.stream.readStringInTransaction();
        if (typeof message !== 'string') {
            return;
        }
        this.emit('pong', message);
    }
}
class MockSocketClient {
    constructor(port) {
        this.port = port;
    }
    get SocketStream() {
        if (this.socketStream === undefined) {
            throw Error('not listening');
        }
        return this.socketStream;
    }
    start() {
        this.def = async_1.createDeferred();
        this.socket = net.connect(this.port, this.connectionListener.bind(this));
        return this.def.promise;
    }
    connectionListener() {
        if (this.socket === undefined || this.def === undefined) {
            throw Error('not started');
        }
        this.socketStream = new SocketStream_1.SocketStream(this.socket, new Buffer(''));
        this.def.resolve();
        this.socket.on('error', () => { });
        this.socket.on('data', (data) => {
            try {
                this.SocketStream.Append(data);
                // We can only receive ping messages
                this.SocketStream.BeginTransaction();
                const cmdIdBytes = [];
                for (let counter = 0; counter < 4; counter += 1) {
                    const byte = this.SocketStream.ReadByte();
                    if (typeof byte !== 'number') {
                        this.SocketStream.RollBackTransaction();
                        return;
                    }
                    cmdIdBytes.push(byte);
                }
                const cmdId = new Buffer(cmdIdBytes).toString();
                const message = this.SocketStream.ReadString();
                if (typeof message !== 'string') {
                    this.SocketStream.RollBackTransaction();
                    return;
                }
                this.SocketStream.EndTransaction();
                if (cmdId !== 'ping') {
                    this.SocketStream.Write(new Buffer(ResponseCommands.Error));
                    const errorMessage = `Received unknown command '${cmdId}'`;
                    const errorBuffer = Buffer.concat([Buffer.concat([new Buffer('A'), uint64be.encode(errorMessage.length)]), new Buffer(errorMessage)]);
                    this.SocketStream.Write(errorBuffer);
                    return;
                }
                this.SocketStream.Write(new Buffer(ResponseCommands.Pong));
                const messageBuffer = new Buffer(message);
                const pongBuffer = Buffer.concat([Buffer.concat([new Buffer('U'), uint64be.encode(messageBuffer.byteLength)]), messageBuffer]);
                this.SocketStream.Write(pongBuffer);
            }
            catch (ex) {
                this.SocketStream.Write(new Buffer(ResponseCommands.Error));
                const errorMessage = `Fatal error in handling data at socket client. Error: ${ex.message}`;
                const errorBuffer = Buffer.concat([Buffer.concat([new Buffer('A'), uint64be.encode(errorMessage.length)]), new Buffer(errorMessage)]);
                this.SocketStream.Write(errorBuffer);
            }
        });
    }
}
// Defines a Mocha test suite to group tests of similar kind together
suite('SocketCallbackHandler', () => {
    let socketServer;
    setup(() => socketServer = new socketServer_1.SocketServer());
    teardown(() => socketServer.Stop());
    test('Succesfully starts without any specific host or port', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start();
        chai_1.expect(port).to.be.greaterThan(0);
    }));
    test('Succesfully starts with port=0 and no host', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start({ port: 0 });
        chai_1.expect(port).to.be.greaterThan(0);
    }));
    test('Succesfully starts with port=0 and host=localhost', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start({ port: 0, host: 'localhost' });
        chai_1.expect(port).to.be.greaterThan(0);
    }));
    test('Succesfully starts with host=127.0.0.1', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start({ host: '127.0.0.1' });
        chai_1.expect(port).to.be.greaterThan(0);
    }));
    test('Succesfully starts with port=0 and host=127.0.0.1', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start({ port: 0, host: '127.0.0.1' });
        chai_1.expect(port).to.be.greaterThan(0);
    }));
    test('Succesfully starts with specific port', () => __awaiter(this, void 0, void 0, function* () {
        const availablePort = yield getFreePort({ host: 'localhost' });
        const port = yield socketServer.Start({ port: availablePort, host: 'localhost' });
        chai_1.expect(port).to.be.equal(availablePort);
    }));
    test('Succesful Handshake', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start();
        const callbackHandler = new MockSocketCallbackHandler(socketServer);
        const socketClient = new MockSocketClient(port);
        yield socketClient.start();
        const def = async_1.createDeferred();
        callbackHandler.on('handshake', () => {
            def.resolve();
        });
        callbackHandler.on('error', (actual, expected, message) => {
            if (!def.completed) {
                def.reject({ actual: actual, expected: expected, message: message });
            }
        });
        // Client has connected, now send information to the callback handler via sockets
        const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
        socketClient.SocketStream.Write(guidBuffer);
        socketClient.SocketStream.WriteInt32(PID);
        yield def.promise;
    }));
    test('Unsuccesful Handshake', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start();
        const callbackHandler = new MockSocketCallbackHandler(socketServer);
        const socketClient = new MockSocketClient(port);
        yield socketClient.start();
        const def = async_1.createDeferred();
        let timeOut = setTimeout(() => {
            def.reject('Handshake not completed in allocated time');
        }, 5000);
        callbackHandler.on('handshake', () => {
            if (timeOut) {
                clearTimeout(timeOut);
                timeOut = undefined;
            }
            def.reject('handshake should fail, but it succeeded!');
        });
        callbackHandler.on('error', (actual, expected, message) => {
            if (timeOut) {
                clearTimeout(timeOut);
                timeOut = undefined;
            }
            if (actual === 0 && message === 'pids not the same') {
                def.resolve();
            }
            else {
                def.reject({ actual: actual, expected: expected, message: message });
            }
        });
        // Client has connected, now send information to the callback handler via sockets
        const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
        socketClient.SocketStream.Write(guidBuffer);
        // Send the wrong pid
        socketClient.SocketStream.WriteInt32(0);
        yield def.promise;
    }));
    test('Ping with message', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start();
        const callbackHandler = new MockSocketCallbackHandler(socketServer);
        const socketClient = new MockSocketClient(port);
        yield socketClient.start();
        const def = async_1.createDeferred();
        const PING_MESSAGE = 'This is the Ping Message - Функция проверки ИНН и КПП - 说明';
        callbackHandler.on('handshake', () => {
            // Send a custom message (only after handshake has been done)
            callbackHandler.ping(PING_MESSAGE);
        });
        callbackHandler.on('pong', (message) => {
            try {
                chai_1.expect(message).to.be.equal(PING_MESSAGE);
                def.resolve();
            }
            catch (ex) {
                def.reject(ex);
            }
        });
        callbackHandler.on('error', (actual, expected, message) => {
            if (!def.completed) {
                def.reject({ actual: actual, expected: expected, message: message });
            }
        });
        // Client has connected, now send information to the callback handler via sockets
        const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
        socketClient.SocketStream.Write(guidBuffer);
        // Send the wrong pid
        socketClient.SocketStream.WriteInt32(PID);
        yield def.promise;
    }));
    test('Succesful Handshake with port=0 and host=localhost', () => __awaiter(this, void 0, void 0, function* () {
        const port = yield socketServer.Start({ port: 0, host: 'localhost' });
        const callbackHandler = new MockSocketCallbackHandler(socketServer);
        const socketClient = new MockSocketClient(port);
        yield socketClient.start();
        const def = async_1.createDeferred();
        callbackHandler.on('handshake', () => def.resolve());
        callbackHandler.on('error', (actual, expected, message) => {
            if (!def.completed) {
                def.reject({ actual: actual, expected: expected, message: message });
            }
        });
        // Client has connected, now send information to the callback handler via sockets
        const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
        socketClient.SocketStream.Write(guidBuffer);
        socketClient.SocketStream.WriteInt32(PID);
        yield def.promise;
    }));
    test('Succesful Handshake with specific port', () => __awaiter(this, void 0, void 0, function* () {
        const availablePort = yield new Promise((resolve, reject) => getFreePort({ host: 'localhost' }).then(resolve, reject));
        const port = yield socketServer.Start({ port: availablePort, host: 'localhost' });
        chai_1.expect(port).to.be.equal(availablePort, 'Server is not listening on the provided port number');
        const callbackHandler = new MockSocketCallbackHandler(socketServer);
        const socketClient = new MockSocketClient(port);
        yield socketClient.start();
        const def = async_1.createDeferred();
        callbackHandler.on('handshake', () => def.resolve());
        callbackHandler.on('error', (actual, expected, message) => {
            if (!def.completed) {
                def.reject({ actual: actual, expected: expected, message: message });
            }
        });
        // Client has connected, now send information to the callback handler via sockets
        const guidBuffer = Buffer.concat([new Buffer('A'), uint64be.encode(GUID.length), new Buffer(GUID)]);
        socketClient.SocketStream.Write(guidBuffer);
        socketClient.SocketStream.WriteInt32(PID);
        yield def.promise;
    }));
});
//# sourceMappingURL=socketCallbackHandler.test.js.map