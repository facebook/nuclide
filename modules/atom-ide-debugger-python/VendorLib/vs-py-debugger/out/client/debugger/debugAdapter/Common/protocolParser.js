"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-constant-condition no-typeof-undefined
const events_1 = require("events");
const inversify_1 = require("inversify");
const PROTOCOL_START_INDENTIFIER = '\r\n\r\n';
/**
 * Parsers the debugger Protocol messages and raises the following events:
 * 1. 'data', message (for all protocol messages)
 * 1. 'event_<event name>', message (for all protocol events)
 * 1. 'request_<command name>', message (for all protocol requests)
 * 1. 'response_<command name>', message (for all protocol responses)
 * 1. '<type>', message (for all protocol messages that are not events, requests nor responses)
 * @export
 * @class ProtocolParser
 * @extends {EventEmitter}
 * @implements {IProtocolParser}
 */
let ProtocolParser = class ProtocolParser extends events_1.EventEmitter {
    constructor() {
        super();
        this.rawData = new Buffer(0);
        this.contentLength = -1;
        this.disposed = false;
        this.dataCallbackHandler = (data) => {
            this.handleData(data);
        };
    }
    dispose() {
        if (this.stream) {
            this.stream.removeListener('data', this.dataCallbackHandler);
            this.stream = undefined;
        }
    }
    connect(stream) {
        this.stream = stream;
        stream.addListener('data', this.dataCallbackHandler);
    }
    dispatch(body) {
        const message = JSON.parse(body);
        switch (message.type) {
            case 'event': {
                const event = message;
                if (typeof event.event === 'string') {
                    this.emit(`${message.type}_${event.event}`, event);
                    break;
                }
            }
            case 'request': {
                const request = message;
                if (typeof request.command === 'string') {
                    this.emit(`${message.type}_${request.command}`, request);
                    break;
                }
            }
            case 'response': {
                const reponse = message;
                if (typeof reponse.command === 'string') {
                    this.emit(`${message.type}_${reponse.command}`, reponse);
                    break;
                }
            }
            default: {
                this.emit(`${message.type}`, message);
            }
        }
        this.emit('data', message);
    }
    handleData(data) {
        if (this.disposed) {
            return;
        }
        this.rawData = Buffer.concat([this.rawData, data]);
        while (true) {
            if (this.contentLength >= 0) {
                if (this.rawData.length >= this.contentLength) {
                    const message = this.rawData.toString('utf8', 0, this.contentLength);
                    this.rawData = this.rawData.slice(this.contentLength);
                    this.contentLength = -1;
                    if (message.length > 0) {
                        this.dispatch(message);
                    }
                    // there may be more complete messages to process.
                    continue;
                }
            }
            else {
                const idx = this.rawData.indexOf(PROTOCOL_START_INDENTIFIER);
                if (idx !== -1) {
                    const header = this.rawData.toString('utf8', 0, idx);
                    const lines = header.split('\r\n');
                    for (const line of lines) {
                        const pair = line.split(/: +/);
                        if (pair[0] === 'Content-Length') {
                            this.contentLength = +pair[1];
                        }
                    }
                    this.rawData = this.rawData.slice(idx + PROTOCOL_START_INDENTIFIER.length);
                    continue;
                }
            }
            break;
        }
    }
};
ProtocolParser = __decorate([
    inversify_1.injectable()
], ProtocolParser);
exports.ProtocolParser = ProtocolParser;
//# sourceMappingURL=protocolParser.js.map