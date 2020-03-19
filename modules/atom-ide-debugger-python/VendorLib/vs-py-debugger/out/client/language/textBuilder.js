"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const characters_1 = require("./characters");
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
class TextBuilder {
    constructor() {
        this.segments = [];
    }
    getText() {
        if (this.isLastWhiteSpace()) {
            this.segments.pop();
        }
        return this.segments.join('');
    }
    softAppendSpace(count = 1) {
        if (this.segments.length === 0) {
            return;
        }
        if (this.isLastWhiteSpace()) {
            count = count - 1;
        }
        for (let i = 0; i < count; i += 1) {
            this.segments.push(' ');
        }
    }
    append(text) {
        this.segments.push(text);
    }
    isLastWhiteSpace() {
        return this.segments.length > 0 && this.isWhitespace(this.segments[this.segments.length - 1]);
    }
    isWhitespace(s) {
        for (let i = 0; i < s.length; i += 1) {
            if (!characters_1.isWhiteSpace(s.charCodeAt(i))) {
                return false;
            }
        }
        return true;
    }
}
exports.TextBuilder = TextBuilder;
//# sourceMappingURL=textBuilder.js.map