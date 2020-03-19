// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const characters_1 = require("./characters");
const characterStream_1 = require("./characterStream");
const textRangeCollection_1 = require("./textRangeCollection");
const types_1 = require("./types");
var QuoteType;
(function (QuoteType) {
    QuoteType[QuoteType["None"] = 0] = "None";
    QuoteType[QuoteType["Single"] = 1] = "Single";
    QuoteType[QuoteType["Double"] = 2] = "Double";
    QuoteType[QuoteType["TripleSingle"] = 3] = "TripleSingle";
    QuoteType[QuoteType["TripleDouble"] = 4] = "TripleDouble";
})(QuoteType || (QuoteType = {}));
class Token extends types_1.TextRange {
    constructor(type, start, length) {
        super(start, length);
        this.type = type;
    }
}
class Tokenizer {
    constructor() {
        this.cs = new characterStream_1.CharacterStream('');
        this.tokens = [];
        this.mode = types_1.TokenizerMode.Full;
    }
    tokenize(text, start, length, mode) {
        if (start === undefined) {
            start = 0;
        }
        else if (start < 0 || start >= text.length) {
            throw new Error('Invalid range start');
        }
        if (length === undefined) {
            length = text.length;
        }
        else if (length < 0 || start + length > text.length) {
            throw new Error('Invalid range length');
        }
        this.mode = mode !== undefined ? mode : types_1.TokenizerMode.Full;
        this.cs = new characterStream_1.CharacterStream(text);
        this.cs.position = start;
        const end = start + length;
        while (!this.cs.isEndOfStream()) {
            this.AddNextToken();
            if (this.cs.position >= end) {
                break;
            }
        }
        return new textRangeCollection_1.TextRangeCollection(this.tokens);
    }
    AddNextToken() {
        this.cs.skipWhitespace();
        if (this.cs.isEndOfStream()) {
            return;
        }
        if (!this.handleCharacter()) {
            this.cs.moveNext();
        }
    }
    // tslint:disable-next-line:cyclomatic-complexity
    handleCharacter() {
        // f-strings, b-strings, etc
        const stringPrefixLength = this.getStringPrefixLength();
        if (stringPrefixLength >= 0) {
            // Indeed a string
            this.cs.advance(stringPrefixLength);
            const quoteType = this.getQuoteType();
            if (quoteType !== QuoteType.None) {
                this.handleString(quoteType, stringPrefixLength);
                return true;
            }
        }
        if (this.cs.currentChar === 35 /* Hash */) {
            this.handleComment();
            return true;
        }
        if (this.mode === types_1.TokenizerMode.CommentsAndStrings) {
            return false;
        }
        switch (this.cs.currentChar) {
            case 40 /* OpenParenthesis */:
                this.tokens.push(new Token(types_1.TokenType.OpenBrace, this.cs.position, 1));
                break;
            case 41 /* CloseParenthesis */:
                this.tokens.push(new Token(types_1.TokenType.CloseBrace, this.cs.position, 1));
                break;
            case 91 /* OpenBracket */:
                this.tokens.push(new Token(types_1.TokenType.OpenBracket, this.cs.position, 1));
                break;
            case 93 /* CloseBracket */:
                this.tokens.push(new Token(types_1.TokenType.CloseBracket, this.cs.position, 1));
                break;
            case 123 /* OpenBrace */:
                this.tokens.push(new Token(types_1.TokenType.OpenCurly, this.cs.position, 1));
                break;
            case 125 /* CloseBrace */:
                this.tokens.push(new Token(types_1.TokenType.CloseCurly, this.cs.position, 1));
                break;
            case 44 /* Comma */:
                this.tokens.push(new Token(types_1.TokenType.Comma, this.cs.position, 1));
                break;
            case 59 /* Semicolon */:
                this.tokens.push(new Token(types_1.TokenType.Semicolon, this.cs.position, 1));
                break;
            case 58 /* Colon */:
                this.tokens.push(new Token(types_1.TokenType.Colon, this.cs.position, 1));
                break;
            default:
                if (this.isPossibleNumber()) {
                    if (this.tryNumber()) {
                        return true;
                    }
                }
                if (this.cs.currentChar === 46 /* Period */) {
                    this.tokens.push(new Token(types_1.TokenType.Operator, this.cs.position, 1));
                    break;
                }
                if (!this.tryIdentifier()) {
                    if (!this.tryOperator()) {
                        this.handleUnknown();
                    }
                }
                return true;
        }
        return false;
    }
    tryIdentifier() {
        const start = this.cs.position;
        if (characters_1.isIdentifierStartChar(this.cs.currentChar)) {
            this.cs.moveNext();
            while (characters_1.isIdentifierChar(this.cs.currentChar)) {
                this.cs.moveNext();
            }
        }
        if (this.cs.position > start) {
            // const text = this.cs.getText().substr(start, this.cs.position - start);
            // const type = this.keywords.find((value, index) => value === text) ? TokenType.Keyword : TokenType.Identifier;
            this.tokens.push(new Token(types_1.TokenType.Identifier, start, this.cs.position - start));
            return true;
        }
        return false;
    }
    // tslint:disable-next-line:cyclomatic-complexity
    isPossibleNumber() {
        if (characters_1.isDecimal(this.cs.currentChar)) {
            return true;
        }
        if (this.cs.currentChar === 46 /* Period */ && characters_1.isDecimal(this.cs.nextChar)) {
            return true;
        }
        const next = (this.cs.currentChar === 45 /* Hyphen */ || this.cs.currentChar === 43 /* Plus */) ? 1 : 0;
        // Next character must be decimal or a dot otherwise
        // it is not a number. No whitespace is allowed.
        if (characters_1.isDecimal(this.cs.lookAhead(next)) || this.cs.lookAhead(next) === 46 /* Period */) {
            // Check what previous token is, if any
            if (this.tokens.length === 0) {
                // At the start of the file this can only be a number
                return true;
            }
            const prev = this.tokens[this.tokens.length - 1];
            if (prev.type === types_1.TokenType.OpenBrace
                || prev.type === types_1.TokenType.OpenBracket
                || prev.type === types_1.TokenType.Comma
                || prev.type === types_1.TokenType.Colon
                || prev.type === types_1.TokenType.Semicolon
                || prev.type === types_1.TokenType.Operator) {
                return true;
            }
        }
        if (this.cs.lookAhead(next) === 48 /* _0 */) {
            const nextNext = this.cs.lookAhead(next + 1);
            if (nextNext === 120 /* x */ || nextNext === 88 /* X */) {
                return true;
            }
            if (nextNext === 98 /* b */ || nextNext === 66 /* B */) {
                return true;
            }
            if (nextNext === 111 /* o */ || nextNext === 79 /* O */) {
                return true;
            }
        }
        return false;
    }
    // tslint:disable-next-line:cyclomatic-complexity
    tryNumber() {
        const start = this.cs.position;
        let leadingSign = 0;
        if (this.cs.currentChar === 45 /* Hyphen */ || this.cs.currentChar === 43 /* Plus */) {
            this.cs.moveNext(); // Skip leading +/-
            leadingSign = 1;
        }
        if (this.cs.currentChar === 48 /* _0 */) {
            let radix = 0;
            // Try hex => hexinteger: "0" ("x" | "X") (["_"] hexdigit)+
            if ((this.cs.nextChar === 120 /* x */ || this.cs.nextChar === 88 /* X */) && characters_1.isHex(this.cs.lookAhead(2))) {
                this.cs.advance(2);
                while (characters_1.isHex(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 16;
            }
            // Try binary => bininteger: "0" ("b" | "B") (["_"] bindigit)+
            if ((this.cs.nextChar === 98 /* b */ || this.cs.nextChar === 66 /* B */) && characters_1.isBinary(this.cs.lookAhead(2))) {
                this.cs.advance(2);
                while (characters_1.isBinary(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 2;
            }
            // Try octal => octinteger: "0" ("o" | "O") (["_"] octdigit)+
            if ((this.cs.nextChar === 111 /* o */ || this.cs.nextChar === 79 /* O */) && characters_1.isOctal(this.cs.lookAhead(2))) {
                this.cs.advance(2);
                while (characters_1.isOctal(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 8;
            }
            if (radix > 0) {
                const text = this.cs.getText().substr(start + leadingSign, this.cs.position - start - leadingSign);
                if (!isNaN(parseInt(text, radix))) {
                    this.tokens.push(new Token(types_1.TokenType.Number, start, text.length + leadingSign));
                    return true;
                }
            }
        }
        let decimal = false;
        // Try decimal int =>
        //    decinteger: nonzerodigit (["_"] digit)* | "0" (["_"] "0")*
        //    nonzerodigit: "1"..."9"
        //    digit: "0"..."9"
        if (this.cs.currentChar >= 49 /* _1 */ && this.cs.currentChar <= 57 /* _9 */) {
            while (characters_1.isDecimal(this.cs.currentChar)) {
                this.cs.moveNext();
            }
            decimal = this.cs.currentChar !== 46 /* Period */ && this.cs.currentChar !== 101 /* e */ && this.cs.currentChar !== 69 /* E */;
        }
        if (this.cs.currentChar === 48 /* _0 */) { // "0" (["_"] "0")*
            while (this.cs.currentChar === 48 /* _0 */ || this.cs.currentChar === 95 /* Underscore */) {
                this.cs.moveNext();
            }
            decimal = this.cs.currentChar !== 46 /* Period */ && this.cs.currentChar !== 101 /* e */ && this.cs.currentChar !== 69 /* E */;
        }
        if (decimal) {
            const text = this.cs.getText().substr(start + leadingSign, this.cs.position - start - leadingSign);
            if (!isNaN(parseInt(text, 10))) {
                this.tokens.push(new Token(types_1.TokenType.Number, start, text.length + leadingSign));
                return true;
            }
        }
        // Floating point. Sign was already skipped over.
        if ((this.cs.currentChar >= 48 /* _0 */ && this.cs.currentChar <= 57 /* _9 */) ||
            (this.cs.currentChar === 46 /* Period */ && this.cs.nextChar >= 48 /* _0 */ && this.cs.nextChar <= 57 /* _9 */)) {
            if (this.skipFloatingPointCandidate(false)) {
                const text = this.cs.getText().substr(start, this.cs.position - start);
                if (!isNaN(parseFloat(text))) {
                    this.tokens.push(new Token(types_1.TokenType.Number, start, this.cs.position - start));
                    return true;
                }
            }
        }
        this.cs.position = start;
        return false;
    }
    // tslint:disable-next-line:cyclomatic-complexity
    tryOperator() {
        let length = 0;
        const nextChar = this.cs.nextChar;
        switch (this.cs.currentChar) {
            case 43 /* Plus */:
            case 38 /* Ampersand */:
            case 124 /* Bar */:
            case 94 /* Caret */:
            case 61 /* Equal */:
            case 33 /* ExclamationMark */:
            case 37 /* Percent */:
            case 126 /* Tilde */:
                length = nextChar === 61 /* Equal */ ? 2 : 1;
                break;
            case 45 /* Hyphen */:
                length = nextChar === 61 /* Equal */ || nextChar === 62 /* Greater */ ? 2 : 1;
                break;
            case 42 /* Asterisk */:
                if (nextChar === 42 /* Asterisk */) {
                    length = this.cs.lookAhead(2) === 61 /* Equal */ ? 3 : 2;
                }
                else {
                    length = nextChar === 61 /* Equal */ ? 2 : 1;
                }
                break;
            case 47 /* Slash */:
                if (nextChar === 47 /* Slash */) {
                    length = this.cs.lookAhead(2) === 61 /* Equal */ ? 3 : 2;
                }
                else {
                    length = nextChar === 61 /* Equal */ ? 2 : 1;
                }
                break;
            case 60 /* Less */:
                if (nextChar === 62 /* Greater */) {
                    length = 2;
                }
                else if (nextChar === 60 /* Less */) {
                    length = this.cs.lookAhead(2) === 61 /* Equal */ ? 3 : 2;
                }
                else {
                    length = nextChar === 61 /* Equal */ ? 2 : 1;
                }
                break;
            case 62 /* Greater */:
                if (nextChar === 62 /* Greater */) {
                    length = this.cs.lookAhead(2) === 61 /* Equal */ ? 3 : 2;
                }
                else {
                    length = nextChar === 61 /* Equal */ ? 2 : 1;
                }
                break;
            case 64 /* At */:
                length = nextChar === 61 /* Equal */ ? 2 : 1;
                break;
            default:
                return false;
        }
        this.tokens.push(new Token(types_1.TokenType.Operator, this.cs.position, length));
        this.cs.advance(length);
        return length > 0;
    }
    handleUnknown() {
        const start = this.cs.position;
        this.cs.skipToWhitespace();
        const length = this.cs.position - start;
        if (length > 0) {
            this.tokens.push(new Token(types_1.TokenType.Unknown, start, length));
            return true;
        }
        return false;
    }
    handleComment() {
        const start = this.cs.position;
        this.cs.skipToEol();
        this.tokens.push(new Token(types_1.TokenType.Comment, start, this.cs.position - start));
    }
    // tslint:disable-next-line:cyclomatic-complexity
    getStringPrefixLength() {
        if (this.cs.currentChar === 39 /* SingleQuote */ || this.cs.currentChar === 34 /* DoubleQuote */) {
            return 0; // Simple string, no prefix
        }
        if (this.cs.nextChar === 39 /* SingleQuote */ || this.cs.nextChar === 34 /* DoubleQuote */) {
            switch (this.cs.currentChar) {
                case 102 /* f */:
                case 70 /* F */:
                case 114 /* r */:
                case 82 /* R */:
                case 98 /* b */:
                case 66 /* B */:
                case 117 /* u */:
                case 85 /* U */:
                    return 1; // single-char prefix like u"" or r""
                default:
                    break;
            }
        }
        if (this.cs.lookAhead(2) === 39 /* SingleQuote */ || this.cs.lookAhead(2) === 34 /* DoubleQuote */) {
            const prefix = this.cs.getText().substr(this.cs.position, 2).toLowerCase();
            switch (prefix) {
                case 'rf':
                case 'ur':
                case 'br':
                    return 2;
                default:
                    break;
            }
        }
        return -1;
    }
    getQuoteType() {
        if (this.cs.currentChar === 39 /* SingleQuote */) {
            return this.cs.nextChar === 39 /* SingleQuote */ && this.cs.lookAhead(2) === 39 /* SingleQuote */
                ? QuoteType.TripleSingle
                : QuoteType.Single;
        }
        if (this.cs.currentChar === 34 /* DoubleQuote */) {
            return this.cs.nextChar === 34 /* DoubleQuote */ && this.cs.lookAhead(2) === 34 /* DoubleQuote */
                ? QuoteType.TripleDouble
                : QuoteType.Double;
        }
        return QuoteType.None;
    }
    handleString(quoteType, stringPrefixLength) {
        const start = this.cs.position - stringPrefixLength;
        if (quoteType === QuoteType.Single || quoteType === QuoteType.Double) {
            this.cs.moveNext();
            this.skipToSingleEndQuote(quoteType === QuoteType.Single
                ? 39 /* SingleQuote */
                : 34 /* DoubleQuote */);
        }
        else {
            this.cs.advance(3);
            this.skipToTripleEndQuote(quoteType === QuoteType.TripleSingle
                ? 39 /* SingleQuote */
                : 34 /* DoubleQuote */);
        }
        this.tokens.push(new Token(types_1.TokenType.String, start, this.cs.position - start));
    }
    skipToSingleEndQuote(quote) {
        while (!this.cs.isEndOfStream()) {
            if (this.cs.currentChar === 10 /* LineFeed */ || this.cs.currentChar === 13 /* CarriageReturn */) {
                return; // Unterminated single-line string
            }
            if (this.cs.currentChar === 92 /* Backslash */ && this.cs.nextChar === quote) {
                this.cs.advance(2);
                continue;
            }
            if (this.cs.currentChar === quote) {
                break;
            }
            this.cs.moveNext();
        }
        this.cs.moveNext();
    }
    skipToTripleEndQuote(quote) {
        while (!this.cs.isEndOfStream() && (this.cs.currentChar !== quote || this.cs.nextChar !== quote || this.cs.lookAhead(2) !== quote)) {
            this.cs.moveNext();
        }
        this.cs.advance(3);
    }
    skipFloatingPointCandidate(allowSign) {
        // Determine end of the potential floating point number
        const start = this.cs.position;
        this.skipFractionalNumber(allowSign);
        if (this.cs.position > start) {
            if (this.cs.currentChar === 101 /* e */ || this.cs.currentChar === 69 /* E */) {
                this.cs.moveNext(); // Optional exponent sign
            }
            this.skipDecimalNumber(true); // skip exponent value
        }
        return this.cs.position > start;
    }
    skipFractionalNumber(allowSign) {
        this.skipDecimalNumber(allowSign);
        if (this.cs.currentChar === 46 /* Period */) {
            this.cs.moveNext(); // Optional period
        }
        this.skipDecimalNumber(false);
    }
    skipDecimalNumber(allowSign) {
        if (allowSign && (this.cs.currentChar === 45 /* Hyphen */ || this.cs.currentChar === 43 /* Plus */)) {
            this.cs.moveNext(); // Optional sign
        }
        while (characters_1.isDecimal(this.cs.currentChar)) {
            this.cs.moveNext(); // skip integer part
        }
    }
}
exports.Tokenizer = Tokenizer;
//# sourceMappingURL=tokenizer.js.map