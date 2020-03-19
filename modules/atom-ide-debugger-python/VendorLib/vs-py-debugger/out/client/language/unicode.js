// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-require-imports no-var-requires
var UnicodeCategory;
(function (UnicodeCategory) {
    UnicodeCategory[UnicodeCategory["Unknown"] = 0] = "Unknown";
    UnicodeCategory[UnicodeCategory["UppercaseLetter"] = 1] = "UppercaseLetter";
    UnicodeCategory[UnicodeCategory["LowercaseLetter"] = 2] = "LowercaseLetter";
    UnicodeCategory[UnicodeCategory["TitlecaseLetter"] = 3] = "TitlecaseLetter";
    UnicodeCategory[UnicodeCategory["ModifierLetter"] = 4] = "ModifierLetter";
    UnicodeCategory[UnicodeCategory["OtherLetter"] = 5] = "OtherLetter";
    UnicodeCategory[UnicodeCategory["LetterNumber"] = 6] = "LetterNumber";
    UnicodeCategory[UnicodeCategory["NonSpacingMark"] = 7] = "NonSpacingMark";
    UnicodeCategory[UnicodeCategory["SpacingCombiningMark"] = 8] = "SpacingCombiningMark";
    UnicodeCategory[UnicodeCategory["DecimalDigitNumber"] = 9] = "DecimalDigitNumber";
    UnicodeCategory[UnicodeCategory["ConnectorPunctuation"] = 10] = "ConnectorPunctuation";
})(UnicodeCategory = exports.UnicodeCategory || (exports.UnicodeCategory = {}));
function getUnicodeCategory(ch) {
    const unicodeLu = require('unicode/category/Lu');
    const unicodeLl = require('unicode/category/Ll');
    const unicodeLt = require('unicode/category/Lt');
    const unicodeLo = require('unicode/category/Lo');
    const unicodeLm = require('unicode/category/Lm');
    const unicodeNl = require('unicode/category/Nl');
    const unicodeMn = require('unicode/category/Mn');
    const unicodeMc = require('unicode/category/Mc');
    const unicodeNd = require('unicode/category/Nd');
    const unicodePc = require('unicode/category/Pc');
    if (unicodeLu[ch]) {
        return UnicodeCategory.UppercaseLetter;
    }
    if (unicodeLl[ch]) {
        return UnicodeCategory.LowercaseLetter;
    }
    if (unicodeLt[ch]) {
        return UnicodeCategory.TitlecaseLetter;
    }
    if (unicodeLo[ch]) {
        return UnicodeCategory.OtherLetter;
    }
    if (unicodeLm[ch]) {
        return UnicodeCategory.ModifierLetter;
    }
    if (unicodeNl[ch]) {
        return UnicodeCategory.LetterNumber;
    }
    if (unicodeMn[ch]) {
        return UnicodeCategory.NonSpacingMark;
    }
    if (unicodeMc[ch]) {
        return UnicodeCategory.SpacingCombiningMark;
    }
    if (unicodeNd[ch]) {
        return UnicodeCategory.DecimalDigitNumber;
    }
    if (unicodePc[ch]) {
        return UnicodeCategory.ConnectorPunctuation;
    }
    return UnicodeCategory.Unknown;
}
exports.getUnicodeCategory = getUnicodeCategory;
//# sourceMappingURL=unicode.js.map