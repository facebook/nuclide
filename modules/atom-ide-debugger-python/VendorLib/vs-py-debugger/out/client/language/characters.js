"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const unicode_1 = require("./unicode");
function isIdentifierStartChar(ch) {
    switch (ch) {
        // Underscore is explicitly allowed to start an identifier
        case 95 /* Underscore */:
            return true;
        // Characters with the Other_ID_Start property
        case 0x1885:
        case 0x1886:
        case 0x2118:
        case 0x212E:
        case 0x309B:
        case 0x309C:
            return true;
        default:
            break;
    }
    const cat = unicode_1.getUnicodeCategory(ch);
    switch (cat) {
        // Supported categories for starting an identifier
        case unicode_1.UnicodeCategory.UppercaseLetter:
        case unicode_1.UnicodeCategory.LowercaseLetter:
        case unicode_1.UnicodeCategory.TitlecaseLetter:
        case unicode_1.UnicodeCategory.ModifierLetter:
        case unicode_1.UnicodeCategory.OtherLetter:
        case unicode_1.UnicodeCategory.LetterNumber:
            return true;
        default:
            break;
    }
    return false;
}
exports.isIdentifierStartChar = isIdentifierStartChar;
function isIdentifierChar(ch) {
    if (isIdentifierStartChar(ch)) {
        return true;
    }
    switch (ch) {
        // Characters with the Other_ID_Continue property
        case 0x00B7:
        case 0x0387:
        case 0x1369:
        case 0x136A:
        case 0x136B:
        case 0x136C:
        case 0x136D:
        case 0x136E:
        case 0x136F:
        case 0x1370:
        case 0x1371:
        case 0x19DA:
            return true;
        default:
            break;
    }
    switch (unicode_1.getUnicodeCategory(ch)) {
        // Supported categories for continuing an identifier
        case unicode_1.UnicodeCategory.NonSpacingMark:
        case unicode_1.UnicodeCategory.SpacingCombiningMark:
        case unicode_1.UnicodeCategory.DecimalDigitNumber:
        case unicode_1.UnicodeCategory.ConnectorPunctuation:
            return true;
        default:
            break;
    }
    return false;
}
exports.isIdentifierChar = isIdentifierChar;
function isWhiteSpace(ch) {
    return ch <= 32 /* Space */ || ch === 0x200B; // Unicode whitespace
}
exports.isWhiteSpace = isWhiteSpace;
function isLineBreak(ch) {
    return ch === 13 /* CarriageReturn */ || ch === 10 /* LineFeed */;
}
exports.isLineBreak = isLineBreak;
function isNumber(ch) {
    return ch >= 48 /* _0 */ && ch <= 57 /* _9 */ || ch === 95 /* Underscore */;
}
exports.isNumber = isNumber;
function isDecimal(ch) {
    return ch >= 48 /* _0 */ && ch <= 57 /* _9 */ || ch === 95 /* Underscore */;
}
exports.isDecimal = isDecimal;
function isHex(ch) {
    return isDecimal(ch) || (ch >= 97 /* a */ && ch <= 102 /* f */) || (ch >= 65 /* A */ && ch <= 70 /* F */) || ch === 95 /* Underscore */;
}
exports.isHex = isHex;
function isOctal(ch) {
    return ch >= 48 /* _0 */ && ch <= 55 /* _7 */ || ch === 95 /* Underscore */;
}
exports.isOctal = isOctal;
function isBinary(ch) {
    return ch === 48 /* _0 */ || ch === 49 /* _1 */ || ch === 95 /* Underscore */;
}
exports.isBinary = isBinary;
//# sourceMappingURL=characters.js.map