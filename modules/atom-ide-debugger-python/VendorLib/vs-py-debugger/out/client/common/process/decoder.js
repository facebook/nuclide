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
const iconv = require("iconv-lite");
const inversify_1 = require("inversify");
const constants_1 = require("./constants");
let BufferDecoder = class BufferDecoder {
    decode(buffers, encoding = constants_1.DEFAULT_ENCODING) {
        encoding = iconv.encodingExists(encoding) ? encoding : constants_1.DEFAULT_ENCODING;
        return iconv.decode(Buffer.concat(buffers), encoding);
    }
};
BufferDecoder = __decorate([
    inversify_1.injectable()
], BufferDecoder);
exports.BufferDecoder = BufferDecoder;
//# sourceMappingURL=decoder.js.map