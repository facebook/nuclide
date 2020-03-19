// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const characterStream_1 = require("../../client/language/characterStream");
const textIterator_1 = require("../../client/language/textIterator");
// tslint:disable-next-line:max-func-body-length
suite('Language.CharacterStream', () => {
    test('Iteration (string)', () => __awaiter(this, void 0, void 0, function* () {
        const content = 'some text';
        const cs = new characterStream_1.CharacterStream(content);
        testIteration(cs, content);
    }));
    test('Iteration (iterator)', () => __awaiter(this, void 0, void 0, function* () {
        const content = 'some text';
        const cs = new characterStream_1.CharacterStream(new textIterator_1.TextIterator(content));
        testIteration(cs, content);
    }));
    test('Positioning', () => __awaiter(this, void 0, void 0, function* () {
        const content = 'some text';
        const cs = new characterStream_1.CharacterStream(content);
        assert.equal(cs.position, 0);
        cs.advance(1);
        assert.equal(cs.position, 1);
        cs.advance(1);
        assert.equal(cs.position, 2);
        cs.advance(2);
        assert.equal(cs.position, 4);
        cs.advance(-3);
        assert.equal(cs.position, 1);
        cs.advance(-3);
        assert.equal(cs.position, 0);
        cs.advance(100);
        assert.equal(cs.position, content.length);
    }));
    test('Characters', () => __awaiter(this, void 0, void 0, function* () {
        const content = 'some \ttext "" \' \' \n text \r\n more text';
        const cs = new characterStream_1.CharacterStream(content);
        for (let i = 0; i < content.length; i += 1) {
            assert.equal(cs.currentChar, content.charCodeAt(i));
            assert.equal(cs.nextChar, i < content.length - 1 ? content.charCodeAt(i + 1) : 0);
            assert.equal(cs.prevChar, i > 0 ? content.charCodeAt(i - 1) : 0);
            assert.equal(cs.lookAhead(2), i < content.length - 2 ? content.charCodeAt(i + 2) : 0);
            assert.equal(cs.lookAhead(-2), i > 1 ? content.charCodeAt(i - 2) : 0);
            const ch = content.charCodeAt(i);
            const isLineBreak = ch === 10 /* LineFeed */ || ch === 13 /* CarriageReturn */;
            assert.equal(cs.isAtWhiteSpace(), ch === 9 /* Tab */ || ch === 32 /* Space */ || isLineBreak);
            assert.equal(cs.isAtLineBreak(), isLineBreak);
            assert.equal(cs.isAtString(), ch === 39 /* SingleQuote */ || ch === 34 /* DoubleQuote */);
            cs.moveNext();
        }
    }));
    test('Skip', () => __awaiter(this, void 0, void 0, function* () {
        const content = 'some \ttext "" \' \' \n text \r\n more text';
        const cs = new characterStream_1.CharacterStream(content);
        cs.skipWhitespace();
        assert.equal(cs.position, 0);
        cs.skipToWhitespace();
        assert.equal(cs.position, 4);
        cs.skipToWhitespace();
        assert.equal(cs.position, 4);
        cs.skipWhitespace();
        assert.equal(cs.position, 6);
        cs.skipLineBreak();
        assert.equal(cs.position, 6);
        cs.skipToEol();
        assert.equal(cs.position, 18);
        cs.skipLineBreak();
        assert.equal(cs.position, 19);
    }));
});
function testIteration(cs, content) {
    assert.equal(cs.position, 0);
    assert.equal(cs.length, content.length);
    assert.equal(cs.isEndOfStream(), false);
    for (let i = -2; i < content.length + 2; i += 1) {
        const ch = cs.charCodeAt(i);
        if (i < 0 || i >= content.length) {
            assert.equal(ch, 0);
        }
        else {
            assert.equal(ch, content.charCodeAt(i));
        }
    }
    for (let i = 0; i < content.length; i += 1) {
        assert.equal(cs.isEndOfStream(), false);
        assert.equal(cs.position, i);
        assert.equal(cs.currentChar, content.charCodeAt(i));
        cs.moveNext();
    }
    assert.equal(cs.isEndOfStream(), true);
    assert.equal(cs.position, content.length);
}
//# sourceMappingURL=characterStream.test.js.map