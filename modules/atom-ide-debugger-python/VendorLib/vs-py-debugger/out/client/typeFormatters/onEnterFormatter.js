"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const lineFormatter_1 = require("../formatters/lineFormatter");
const types_1 = require("../language/types");
const providerUtilities_1 = require("../providers/providerUtilities");
class OnEnterFormatter {
    constructor() {
        this.formatter = new lineFormatter_1.LineFormatter();
    }
    provideOnTypeFormattingEdits(document, position, ch, options, cancellationToken) {
        if (position.line === 0) {
            return [];
        }
        // Check case when the entire line belongs to a comment or string
        const prevLine = document.lineAt(position.line - 1);
        const tokens = providerUtilities_1.getDocumentTokens(document, position, types_1.TokenizerMode.CommentsAndStrings);
        const lineStartTokenIndex = tokens.getItemContaining(document.offsetAt(prevLine.range.start));
        const lineEndTokenIndex = tokens.getItemContaining(document.offsetAt(prevLine.range.end));
        if (lineStartTokenIndex >= 0 && lineStartTokenIndex === lineEndTokenIndex) {
            const token = tokens.getItemAt(lineStartTokenIndex);
            if (token.type === types_1.TokenType.Semicolon || token.type === types_1.TokenType.String) {
                return [];
            }
        }
        const formatted = this.formatter.formatLine(document, prevLine.lineNumber);
        if (formatted === prevLine.text) {
            return [];
        }
        return [new vscode_1.TextEdit(prevLine.range, formatted)];
    }
}
exports.OnEnterFormatter = OnEnterFormatter;
//# sourceMappingURL=onEnterFormatter.js.map