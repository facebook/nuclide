// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const iterableTextRange_1 = require("../language/iterableTextRange");
const types_1 = require("../language/types");
const providerUtilities_1 = require("./providerUtilities");
class DocStringFoldingProvider {
    provideFoldingRanges(document, _context, token) {
        return this.getFoldingRanges(document);
    }
    getFoldingRanges(document) {
        const tokenCollection = providerUtilities_1.getDocumentTokens(document, document.lineAt(document.lineCount - 1).range.end, types_1.TokenizerMode.CommentsAndStrings);
        const tokens = new iterableTextRange_1.IterableTextRange(tokenCollection);
        const docStringRanges = [];
        const commentRanges = [];
        for (const token of tokens) {
            const docstringRange = this.getDocStringFoldingRange(document, token);
            if (docstringRange) {
                docStringRanges.push(docstringRange);
                continue;
            }
            const commentRange = this.getSingleLineCommentRange(document, token);
            if (commentRange) {
                this.buildMultiLineCommentRange(commentRange, commentRanges);
            }
        }
        this.removeLastSingleLineComment(commentRanges);
        return docStringRanges.concat(commentRanges);
    }
    buildMultiLineCommentRange(commentRange, commentRanges) {
        if (commentRanges.length === 0) {
            commentRanges.push(commentRange);
            return;
        }
        const previousComment = commentRanges[commentRanges.length - 1];
        if (previousComment.end + 1 === commentRange.start) {
            previousComment.end = commentRange.end;
            return;
        }
        if (previousComment.start === previousComment.end) {
            commentRanges[commentRanges.length - 1] = commentRange;
            return;
        }
        commentRanges.push(commentRange);
    }
    removeLastSingleLineComment(commentRanges) {
        // Remove last comment folding range if its a single line entry.
        if (commentRanges.length === 0) {
            return;
        }
        const lastComment = commentRanges[commentRanges.length - 1];
        if (lastComment.start === lastComment.end) {
            commentRanges.pop();
        }
    }
    getDocStringFoldingRange(document, token) {
        if (token.type !== types_1.TokenType.String) {
            return;
        }
        const startPosition = document.positionAt(token.start);
        const endPosition = document.positionAt(token.end);
        if (startPosition.line === endPosition.line) {
            return;
        }
        const startLine = document.lineAt(startPosition);
        if (startLine.firstNonWhitespaceCharacterIndex !== startPosition.character) {
            return;
        }
        const startIndex1 = startLine.text.indexOf('\'\'\'');
        const startIndex2 = startLine.text.indexOf('"""');
        if (startIndex1 !== startPosition.character && startIndex2 !== startPosition.character) {
            return;
        }
        const range = new vscode_1.Range(startPosition, endPosition);
        return new vscode_1.FoldingRange(range.start.line, range.end.line);
    }
    getSingleLineCommentRange(document, token) {
        if (token.type !== types_1.TokenType.Comment) {
            return;
        }
        const startPosition = document.positionAt(token.start);
        const endPosition = document.positionAt(token.end);
        if (startPosition.line !== endPosition.line) {
            return;
        }
        if (document.lineAt(startPosition).firstNonWhitespaceCharacterIndex !== startPosition.character) {
            return;
        }
        const range = new vscode_1.Range(startPosition, endPosition);
        return new vscode_1.FoldingRange(range.start.line, range.end.line, vscode_1.FoldingRangeKind.Comment);
    }
}
exports.DocStringFoldingProvider = DocStringFoldingProvider;
//# sourceMappingURL=docStringFoldingProvider.js.map