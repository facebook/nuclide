// tslint:disable:quotemark ordered-imports no-any no-empty
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const async_1 = require("../../../common/utils/async");
class BaseDebugServer extends events_1.EventEmitter {
    constructor(debugSession) {
        super();
        this.isRunning = false;
        this.debugSession = debugSession;
        this.debugClientConnected = async_1.createDeferred();
        this.clientSocket = async_1.createDeferred();
    }
    get client() {
        return this.clientSocket.promise;
    }
    get IsRunning() {
        if (this.isRunning === undefined) {
            return false;
        }
        return this.isRunning;
    }
    get DebugClientConnected() {
        return this.debugClientConnected.promise;
    }
}
exports.BaseDebugServer = BaseDebugServer;
//# sourceMappingURL=BaseDebugServer.js.map