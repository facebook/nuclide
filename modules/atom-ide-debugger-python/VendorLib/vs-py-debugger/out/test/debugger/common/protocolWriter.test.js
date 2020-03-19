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
// tslint:disable:no-any
const chai_1 = require("chai");
const stream_1 = require("stream");
const main_1 = require("vscode-debugadapter/lib/main");
const protocolWriter_1 = require("../../../client/debugger/debugAdapter/Common/protocolWriter");
suite('Debugging - Protocol Writer', () => {
    test('Test request, response and event messages', () => __awaiter(this, void 0, void 0, function* () {
        let dataWritten = '';
        const throughOutStream = new stream_1.Transform({
            transform: (chunk, encoding, callback) => {
                dataWritten += chunk.toString('utf8');
                callback(null, chunk);
            }
        });
        const message = new main_1.InitializedEvent();
        message.seq = 123;
        const writer = new protocolWriter_1.ProtocolMessageWriter();
        writer.write(throughOutStream, message);
        const json = JSON.stringify(message);
        const expectedMessage = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
        chai_1.expect(dataWritten).to.be.equal(expectedMessage);
    }));
});
//# sourceMappingURL=protocolWriter.test.js.map