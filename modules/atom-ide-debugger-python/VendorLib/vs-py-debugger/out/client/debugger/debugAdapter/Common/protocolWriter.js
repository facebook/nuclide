// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const inversify_1 = require("inversify");
const TWO_CRLF = '\r\n\r\n';
let ProtocolMessageWriter = class ProtocolMessageWriter {
    write(stream, message) {
        const json = JSON.stringify(message);
        const length = Buffer.byteLength(json, 'utf8');
        stream.write(`Content-Length: ${length.toString()}${TWO_CRLF}`, 'utf8');
        stream.write(json, 'utf8');
    }
};
ProtocolMessageWriter = __decorate([
    inversify_1.injectable()
], ProtocolMessageWriter);
exports.ProtocolMessageWriter = ProtocolMessageWriter;
//# sourceMappingURL=protocolWriter.js.map