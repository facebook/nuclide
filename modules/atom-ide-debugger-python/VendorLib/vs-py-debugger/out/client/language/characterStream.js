// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const characters_1 = require("./characters");
const textIterator_1 = require("./textIterator");
class CharacterStream {
    constructor(text) {
        this.text = typeof text === 'string' ? new textIterator_1.TextIterator(text) : text;
        this._position = 0;
        this._currentChar = text.length > 0 ? text.charCodeAt(0) : 0;
        this._isEndOfStream = text.length === 0;
    }
    getText() {
        return this.text.getText();
    }
    get position() {
        return this._position;
    }
    set position(value) {
        this._position = value;
        this.checkBounds();
    }
    get currentChar() {
        return this._currentChar;
    }
    get nextChar() {
        return this.position + 1 < this.text.length ? this.text.charCodeAt(this.position + 1) : 0;
    }
    get prevChar() {
        return this.position - 1 >= 0 ? this.text.charCodeAt(this.position - 1) : 0;
    }
    isEndOfStream() {
        return this._isEndOfStream;
    }
    lookAhead(offset) {
        const pos = this._position + offset;
        return pos < 0 || pos >= this.text.length ? 0 : this.text.charCodeAt(pos);
    }
    advance(offset) {
        this.position += offset;
    }
    moveNext() {
        if (this._position < this.text.length - 1) {
            // Most common case, no need to check bounds extensively
            this._position += 1;
            this._currentChar = this.text.charCodeAt(this._position);
            return true;
        }
        this.advance(1);
        return !this.isEndOfStream();
    }
    isAtWhiteSpace() {
        return characters_1.isWhiteSpace(this.currentChar);
    }
    isAtLineBreak() {
        return characters_1.isLineBreak(this.currentChar);
    }
    skipLineBreak() {
        if (this._currentChar === 13 /* CarriageReturn */) {
            this.moveNext();
            if (this.currentChar === 10 /* LineFeed */) {
                this.moveNext();
            }
        }
        else if (this._currentChar === 10 /* LineFeed */) {
            this.moveNext();
        }
    }
    skipWhitespace() {
        while (!this.isEndOfStream() && this.isAtWhiteSpace()) {
            this.moveNext();
        }
    }
    skipToEol() {
        while (!this.isEndOfStream() && !this.isAtLineBreak()) {
            this.moveNext();
        }
    }
    skipToWhitespace() {
        while (!this.isEndOfStream() && !this.isAtWhiteSpace()) {
            this.moveNext();
        }
    }
    isAtString() {
        return this.currentChar === 39 /* SingleQuote */ || this.currentChar === 34 /* DoubleQuote */;
    }
    charCodeAt(index) {
        return this.text.charCodeAt(index);
    }
    get length() {
        return this.text.length;
    }
    checkBounds() {
        if (this._position < 0) {
            this._position = 0;
        }
        this._isEndOfStream = this._position >= this.text.length;
        if (this._isEndOfStream) {
            this._position = this.text.length;
        }
        this._currentChar = this._isEndOfStream ? 0 : this.text.charCodeAt(this._position);
    }
}
exports.CharacterStream = CharacterStream;
//# sourceMappingURL=characterStream.js.map