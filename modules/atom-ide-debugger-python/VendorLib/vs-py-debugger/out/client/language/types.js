// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
class TextRange {
    constructor(start, length) {
        if (start < 0) {
            throw new Error('start must be non-negative');
        }
        if (length < 0) {
            throw new Error('length must be non-negative');
        }
        this.start = start;
        this.length = length;
    }
    static fromBounds(start, end) {
        return new TextRange(start, end - start);
    }
    get end() {
        return this.start + this.length;
    }
    contains(position) {
        return position >= this.start && position < this.end;
    }
}
TextRange.empty = TextRange.fromBounds(0, 0);
exports.TextRange = TextRange;
var TokenType;
(function (TokenType) {
    TokenType[TokenType["Unknown"] = 0] = "Unknown";
    TokenType[TokenType["String"] = 1] = "String";
    TokenType[TokenType["Comment"] = 2] = "Comment";
    TokenType[TokenType["Keyword"] = 3] = "Keyword";
    TokenType[TokenType["Number"] = 4] = "Number";
    TokenType[TokenType["Identifier"] = 5] = "Identifier";
    TokenType[TokenType["Operator"] = 6] = "Operator";
    TokenType[TokenType["Colon"] = 7] = "Colon";
    TokenType[TokenType["Semicolon"] = 8] = "Semicolon";
    TokenType[TokenType["Comma"] = 9] = "Comma";
    TokenType[TokenType["OpenBrace"] = 10] = "OpenBrace";
    TokenType[TokenType["CloseBrace"] = 11] = "CloseBrace";
    TokenType[TokenType["OpenBracket"] = 12] = "OpenBracket";
    TokenType[TokenType["CloseBracket"] = 13] = "CloseBracket";
    TokenType[TokenType["OpenCurly"] = 14] = "OpenCurly";
    TokenType[TokenType["CloseCurly"] = 15] = "CloseCurly";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
var TokenizerMode;
(function (TokenizerMode) {
    TokenizerMode[TokenizerMode["CommentsAndStrings"] = 0] = "CommentsAndStrings";
    TokenizerMode[TokenizerMode["Full"] = 1] = "Full";
})(TokenizerMode = exports.TokenizerMode || (exports.TokenizerMode = {}));
//# sourceMappingURL=types.js.map