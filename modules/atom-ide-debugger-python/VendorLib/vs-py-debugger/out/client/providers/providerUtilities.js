"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const tokenizer_1 = require("../language/tokenizer");
const types_1 = require("../language/types");
function getDocumentTokens(document, tokenizeTo, mode) {
    const text = document.getText(new vscode_1.Range(new vscode_1.Position(0, 0), tokenizeTo));
    return new tokenizer_1.Tokenizer().tokenize(text, 0, text.length, mode);
}
exports.getDocumentTokens = getDocumentTokens;
function isPositionInsideStringOrComment(document, position) {
    const tokenizeTo = position.translate(1, 0);
    const tokens = getDocumentTokens(document, tokenizeTo, types_1.TokenizerMode.CommentsAndStrings);
    const offset = document.offsetAt(position);
    const index = tokens.getItemContaining(offset - 1);
    if (index >= 0) {
        const token = tokens.getItemAt(index);
        return token.type === types_1.TokenType.String || token.type === types_1.TokenType.Comment;
    }
    if (offset > 0 && index >= 0) {
        // In case position is at the every end of the comment or unterminated string
        const token = tokens.getItemAt(index);
        return token.end === offset && token.type === types_1.TokenType.Comment;
    }
    return false;
}
exports.isPositionInsideStringOrComment = isPositionInsideStringOrComment;
//# sourceMappingURL=providerUtilities.js.map