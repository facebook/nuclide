// tslint:disable:quotemark ordered-imports member-ordering one-line prefer-const
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const SocketStream_1 = require("./SocketStream");
class SocketCallbackHandler extends events_1.EventEmitter {
    constructor(socketServer) {
        super();
        this.commandHandlers = new Map();
        socketServer.on('data', this.onData.bind(this));
    }
    dispose() {
        this.disposed = true;
        this.commandHandlers.clear();
    }
    onData(socketClient, data) {
        if (this.disposed) {
            return;
        }
        this.HandleIncomingData(data, socketClient);
    }
    get stream() {
        return this._stream;
    }
    SendRawCommand(commandId) {
        this.stream.Write(commandId);
    }
    registerCommandHandler(commandId, handler) {
        this.commandHandlers.set(commandId, handler);
    }
    HandleIncomingData(buffer, socket) {
        if (!this._stream) {
            this._stream = new SocketStream_1.SocketStream(socket, buffer);
        }
        else {
            this._stream.Append(buffer);
        }
        if (!this.handeshakeDone && !this.handleHandshake()) {
            return;
        }
        this.handeshakeDone = true;
        this.HandleIncomingDataFromStream();
        return true;
    }
    HandleIncomingDataFromStream() {
        if (this.stream.Length === 0) {
            return;
        }
        this.stream.BeginTransaction();
        let cmd = this.stream.ReadAsciiString(4);
        if (this.stream.HasInsufficientDataForReading) {
            this.stream.RollBackTransaction();
            return;
        }
        if (this.commandHandlers.has(cmd)) {
            const handler = this.commandHandlers.get(cmd);
            handler();
        }
        else {
            this.emit("error", `Unhandled command '${cmd}'`);
        }
        if (this.stream.HasInsufficientDataForReading) {
            // Most possibly due to insufficient data
            this.stream.RollBackTransaction();
            return;
        }
        this.stream.EndTransaction();
        if (this.stream.Length > 0) {
            this.HandleIncomingDataFromStream();
        }
    }
}
exports.SocketCallbackHandler = SocketCallbackHandler;
//# sourceMappingURL=socketCallbackHandler.js.map