"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const iconv_lite_1 = require("iconv-lite");
const decoder_1 = require("../../../client/common/process/decoder");
const initialize_1 = require("./../../initialize");
suite('Decoder', () => {
    setup(initialize_1.initialize);
    teardown(initialize_1.initialize);
    test('Test decoding utf8 strings', () => {
        const value = 'Sample input string Сделать это';
        const buffer = iconv_lite_1.encode(value, 'utf8');
        const decoder = new decoder_1.BufferDecoder();
        const decodedValue = decoder.decode([buffer]);
        chai_1.expect(decodedValue).equal(value, 'Decoded string is incorrect');
    });
    test('Test decoding cp932 strings', function () {
        if (!iconv_lite_1.encodingExists('cp866')) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        const value = 'Sample input string Сделать это';
        const buffer = iconv_lite_1.encode(value, 'cp866');
        const decoder = new decoder_1.BufferDecoder();
        let decodedValue = decoder.decode([buffer]);
        chai_1.expect(decodedValue).not.equal(value, 'Decoded string is the same');
        decodedValue = decoder.decode([buffer], 'cp866');
        chai_1.expect(decodedValue).equal(value, 'Decoded string is incorrect');
    });
});
//# sourceMappingURL=decoder.test.js.map