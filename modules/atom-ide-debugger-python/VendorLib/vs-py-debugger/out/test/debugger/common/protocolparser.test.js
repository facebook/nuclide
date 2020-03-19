"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const stream_1 = require("stream");
const async_1 = require("../../../client/common/utils/async");
const protocolParser_1 = require("../../../client/debugger/debugAdapter/Common/protocolParser");
const common_1 = require("../../common");
suite('Debugging - Protocol Parser', () => {
    test('Test request, response and event messages', () => __awaiter(this, void 0, void 0, function* () {
        const stream = new stream_1.PassThrough();
        const protocolParser = new protocolParser_1.ProtocolParser();
        protocolParser.connect(stream);
        let messagesDetected = 0;
        protocolParser.on('data', () => messagesDetected += 1);
        const requestDetected = new Promise(resolve => {
            protocolParser.on('request_initialize', () => resolve(true));
        });
        const responseDetected = new Promise(resolve => {
            protocolParser.on('response_initialize', () => resolve(true));
        });
        const eventDetected = new Promise(resolve => {
            protocolParser.on('event_initialized', () => resolve(true));
        });
        stream.write('Content-Length: 289\r\n\r\n{"command":"initialize","arguments":{"clientID":"vscode","adapterID":"pythonExperiment","pathFormat":"path","linesStartAt1":true,"columnsStartAt1":true,"supportsVariableType":true,"supportsVariablePaging":true,"supportsRunInTerminalRequest":true,"locale":"en-us"},"type":"request","seq":1}');
        yield chai_1.expect(requestDetected).to.eventually.equal(true, 'request not parsed');
        stream.write('Content-Length: 265\r\n\r\n{"seq":1,"type":"response","request_seq":1,"command":"initialize","success":true,"body":{"supportsEvaluateForHovers":false,"supportsConditionalBreakpoints":true,"supportsConfigurationDoneRequest":true,"supportsFunctionBreakpoints":false,"supportsSetVariable":true}}');
        yield chai_1.expect(responseDetected).to.eventually.equal(true, 'response not parsed');
        stream.write('Content-Length: 63\r\n\r\n{"type": "event", "seq": 1, "event": "initialized", "body": {}}');
        yield chai_1.expect(eventDetected).to.eventually.equal(true, 'event not parsed');
        chai_1.expect(messagesDetected).to.be.equal(3, 'incorrect number of protocol messages');
    }));
    test('Ensure messages are not received after disposing the parser', () => __awaiter(this, void 0, void 0, function* () {
        const stream = new stream_1.PassThrough();
        const protocolParser = new protocolParser_1.ProtocolParser();
        protocolParser.connect(stream);
        let messagesDetected = 0;
        protocolParser.on('data', () => messagesDetected += 1);
        const requestDetected = new Promise(resolve => {
            protocolParser.on('request_initialize', () => resolve(true));
        });
        stream.write('Content-Length: 289\r\n\r\n{"command":"initialize","arguments":{"clientID":"vscode","adapterID":"pythonExperiment","pathFormat":"path","linesStartAt1":true,"columnsStartAt1":true,"supportsVariableType":true,"supportsVariablePaging":true,"supportsRunInTerminalRequest":true,"locale":"en-us"},"type":"request","seq":1}');
        yield chai_1.expect(requestDetected).to.eventually.equal(true, 'request not parsed');
        protocolParser.dispose();
        const responseDetected = async_1.createDeferred();
        protocolParser.on('response_initialize', () => responseDetected.resolve(true));
        stream.write('Content-Length: 265\r\n\r\n{"seq":1,"type":"response","request_seq":1,"command":"initialize","success":true,"body":{"supportsEvaluateForHovers":false,"supportsConditionalBreakpoints":true,"supportsConfigurationDoneRequest":true,"supportsFunctionBreakpoints":false,"supportsSetVariable":true}}');
        // Wait for messages to go through and get parsed (unnecenssary, but add for testing edge cases).
        yield common_1.sleep(1000);
        chai_1.expect(responseDetected.completed).to.be.equal(false, 'Promise should not have resolved');
    }));
});
//# sourceMappingURL=protocolparser.test.js.map