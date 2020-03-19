"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const braceCounter_1 = require("../language/braceCounter");
const textBuilder_1 = require("../language/textBuilder");
const textRangeCollection_1 = require("../language/textRangeCollection");
const tokenizer_1 = require("../language/tokenizer");
const types_1 = require("../language/types");
const keywordsWithSpaceBeforeBrace = [
    'and', 'as', 'assert', 'await',
    'del',
    'except', 'elif',
    'for', 'from',
    'global',
    'if', 'import', 'in', 'is',
    'lambda',
    'nonlocal', 'not',
    'or',
    'raise', 'return',
    'while', 'with',
    'yield'
];
class LineFormatter {
    constructor() {
        this.builder = new textBuilder_1.TextBuilder();
        this.tokens = new textRangeCollection_1.TextRangeCollection([]);
        this.braceCounter = new braceCounter_1.BraceCounter();
        this.text = '';
        this.lineNumber = 0;
    }
    // tslint:disable-next-line:cyclomatic-complexity
    formatLine(document, lineNumber) {
        this.document = document;
        this.lineNumber = lineNumber;
        this.text = document.lineAt(lineNumber).text;
        this.tokens = new tokenizer_1.Tokenizer().tokenize(this.text);
        this.builder = new textBuilder_1.TextBuilder();
        this.braceCounter = new braceCounter_1.BraceCounter();
        if (this.tokens.count === 0) {
            return this.text;
        }
        const ws = this.text.substr(0, this.tokens.getItemAt(0).start);
        if (ws.length > 0) {
            this.builder.append(ws); // Preserve leading indentation.
        }
        for (let i = 0; i < this.tokens.count; i += 1) {
            const t = this.tokens.getItemAt(i);
            const prev = i > 0 ? this.tokens.getItemAt(i - 1) : undefined;
            const next = i < this.tokens.count - 1 ? this.tokens.getItemAt(i + 1) : undefined;
            switch (t.type) {
                case types_1.TokenType.Operator:
                    this.handleOperator(i);
                    break;
                case types_1.TokenType.Comma:
                    this.builder.append(',');
                    if (next && !this.isCloseBraceType(next.type) && next.type !== types_1.TokenType.Colon) {
                        this.builder.softAppendSpace();
                    }
                    break;
                case types_1.TokenType.Identifier:
                    if (prev && !this.isOpenBraceType(prev.type) && prev.type !== types_1.TokenType.Colon && prev.type !== types_1.TokenType.Operator) {
                        this.builder.softAppendSpace();
                    }
                    const id = this.text.substring(t.start, t.end);
                    this.builder.append(id);
                    if (this.isKeywordWithSpaceBeforeBrace(id) && next && this.isOpenBraceType(next.type)) {
                        // for x in ()
                        this.builder.softAppendSpace();
                    }
                    break;
                case types_1.TokenType.Colon:
                    // x: 1 if not in slice, x[1:y] if inside the slice.
                    this.builder.append(':');
                    if (!this.braceCounter.isOpened(types_1.TokenType.OpenBracket) && (next && next.type !== types_1.TokenType.Colon)) {
                        // Not inside opened [[ ... ] sequence.
                        this.builder.softAppendSpace();
                    }
                    break;
                case types_1.TokenType.Comment:
                    // Add 2 spaces before in-line comment per PEP guidelines.
                    if (prev) {
                        this.builder.softAppendSpace(2);
                    }
                    this.builder.append(this.text.substring(t.start, t.end));
                    break;
                case types_1.TokenType.Semicolon:
                    this.builder.append(';');
                    break;
                default:
                    this.handleOther(t, i);
                    break;
            }
        }
        return this.builder.getText();
    }
    // tslint:disable-next-line:cyclomatic-complexity
    handleOperator(index) {
        const t = this.tokens.getItemAt(index);
        const prev = index > 0 ? this.tokens.getItemAt(index - 1) : undefined;
        const opCode = this.text.charCodeAt(t.start);
        const next = index < this.tokens.count - 1 ? this.tokens.getItemAt(index + 1) : undefined;
        if (t.length === 1) {
            switch (opCode) {
                case 61 /* Equal */:
                    this.handleEqual(t, index);
                    return;
                case 46 /* Period */:
                    if (prev && this.isKeyword(prev, 'from')) {
                        this.builder.softAppendSpace();
                    }
                    this.builder.append('.');
                    if (next && this.isKeyword(next, 'import')) {
                        this.builder.softAppendSpace();
                    }
                    return;
                case 64 /* At */:
                    if (prev) {
                        // Binary case
                        this.builder.softAppendSpace();
                        this.builder.append('@');
                        this.builder.softAppendSpace();
                    }
                    else {
                        this.builder.append('@');
                    }
                    return;
                case 33 /* ExclamationMark */:
                    this.builder.append('!');
                    return;
                case 42 /* Asterisk */:
                    if (prev && this.isKeyword(prev, 'lambda')) {
                        this.builder.softAppendSpace();
                        this.builder.append('*');
                        return;
                    }
                    if (this.handleStarOperator(t, prev)) {
                        return;
                    }
                    break;
                default:
                    break;
            }
        }
        else if (t.length === 2) {
            if (this.text.charCodeAt(t.start) === 42 /* Asterisk */ && this.text.charCodeAt(t.start + 1) === 42 /* Asterisk */) {
                if (this.handleStarOperator(t, prev)) {
                    return;
                }
            }
        }
        // Do not append space if operator is preceded by '(' or ',' as in foo(**kwarg)
        if (prev && (this.isOpenBraceType(prev.type) || prev.type === types_1.TokenType.Comma)) {
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }
        this.builder.softAppendSpace();
        this.builder.append(this.text.substring(t.start, t.end));
        // Check unary case
        if (prev && prev.type === types_1.TokenType.Operator) {
            if (opCode === 45 /* Hyphen */ || opCode === 43 /* Plus */ || opCode === 126 /* Tilde */) {
                return;
            }
        }
        this.builder.softAppendSpace();
    }
    handleStarOperator(current, prev) {
        if (this.text.charCodeAt(current.start) === 42 /* Asterisk */ && this.text.charCodeAt(current.start + 1) === 42 /* Asterisk */) {
            if (!prev || (prev.type !== types_1.TokenType.Identifier && prev.type !== types_1.TokenType.Number)) {
                this.builder.append('**');
                return true;
            }
            if (prev && this.isKeyword(prev, 'lambda')) {
                this.builder.softAppendSpace();
                this.builder.append('**');
                return true;
            }
        }
        // Check previous line for the **/* condition
        const lastLine = this.getPreviousLineTokens();
        const lastToken = lastLine && lastLine.count > 0 ? lastLine.getItemAt(lastLine.count - 1) : undefined;
        if (lastToken && (this.isOpenBraceType(lastToken.type) || lastToken.type === types_1.TokenType.Comma)) {
            this.builder.append(this.text.substring(current.start, current.end));
            return true;
        }
        return false;
    }
    handleEqual(t, index) {
        if (this.isMultipleStatements(index) && !this.braceCounter.isOpened(types_1.TokenType.OpenBrace)) {
            // x = 1; x, y = y, x
            this.builder.softAppendSpace();
            this.builder.append('=');
            this.builder.softAppendSpace();
            return;
        }
        // Check if this is = in function arguments. If so, do not add spaces around it.
        if (this.isEqualsInsideArguments(index)) {
            this.builder.append('=');
            return;
        }
        this.builder.softAppendSpace();
        this.builder.append('=');
        this.builder.softAppendSpace();
    }
    handleOther(t, index) {
        if (this.isBraceType(t.type)) {
            this.braceCounter.countBrace(t);
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }
        const prev = index > 0 ? this.tokens.getItemAt(index - 1) : undefined;
        if (prev && prev.length === 1 && this.text.charCodeAt(prev.start) === 61 /* Equal */ && this.isEqualsInsideArguments(index - 1)) {
            // Don't add space around = inside function arguments.
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }
        if (prev && (this.isOpenBraceType(prev.type) || prev.type === types_1.TokenType.Colon)) {
            // Don't insert space after (, [ or { .
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }
        if (t.type === types_1.TokenType.Number && prev && prev.type === types_1.TokenType.Operator && prev.length === 1 && this.text.charCodeAt(prev.start) === 126 /* Tilde */) {
            // Special case for ~ before numbers
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }
        if (t.type === types_1.TokenType.Unknown) {
            this.handleUnknown(t);
        }
        else {
            // In general, keep tokens separated.
            this.builder.softAppendSpace();
            this.builder.append(this.text.substring(t.start, t.end));
        }
    }
    handleUnknown(t) {
        const prevChar = t.start > 0 ? this.text.charCodeAt(t.start - 1) : 0;
        if (prevChar === 32 /* Space */ || prevChar === 9 /* Tab */) {
            this.builder.softAppendSpace();
        }
        this.builder.append(this.text.substring(t.start, t.end));
        const nextChar = t.end < this.text.length - 1 ? this.text.charCodeAt(t.end) : 0;
        if (nextChar === 32 /* Space */ || nextChar === 9 /* Tab */) {
            this.builder.softAppendSpace();
        }
    }
    // tslint:disable-next-line:cyclomatic-complexity
    isEqualsInsideArguments(index) {
        if (index < 1) {
            return false;
        }
        // We are looking for IDENT = ?
        const prev = this.tokens.getItemAt(index - 1);
        if (prev.type !== types_1.TokenType.Identifier) {
            return false;
        }
        if (index > 1 && this.tokens.getItemAt(index - 2).type === types_1.TokenType.Colon) {
            return false; // Type hint should have spaces around like foo(x: int = 1) per PEP 8
        }
        return this.isInsideFunctionArguments(this.tokens.getItemAt(index).start);
    }
    isOpenBraceType(type) {
        return type === types_1.TokenType.OpenBrace || type === types_1.TokenType.OpenBracket || type === types_1.TokenType.OpenCurly;
    }
    isCloseBraceType(type) {
        return type === types_1.TokenType.CloseBrace || type === types_1.TokenType.CloseBracket || type === types_1.TokenType.CloseCurly;
    }
    isBraceType(type) {
        return this.isOpenBraceType(type) || this.isCloseBraceType(type);
    }
    isMultipleStatements(index) {
        for (let i = index; i >= 0; i -= 1) {
            if (this.tokens.getItemAt(i).type === types_1.TokenType.Semicolon) {
                return true;
            }
        }
        return false;
    }
    isKeywordWithSpaceBeforeBrace(s) {
        return keywordsWithSpaceBeforeBrace.indexOf(s) >= 0;
    }
    isKeyword(t, keyword) {
        return t.type === types_1.TokenType.Identifier && t.length === keyword.length && this.text.substr(t.start, t.length) === keyword;
    }
    // tslint:disable-next-line:cyclomatic-complexity
    isInsideFunctionArguments(position) {
        if (!this.document) {
            return false; // unable to determine
        }
        // Walk up until beginning of the document or line with 'def IDENT(' or line ending with :
        // IDENT( by itself is not reliable since they can be nested in IDENT(IDENT(a), x=1)
        let start = new vscode_1.Position(0, 0);
        for (let i = this.lineNumber; i >= 0; i -= 1) {
            const line = this.document.lineAt(i);
            const lineTokens = new tokenizer_1.Tokenizer().tokenize(line.text);
            if (lineTokens.count === 0) {
                continue;
            }
            // 'def IDENT('
            const first = lineTokens.getItemAt(0);
            if (lineTokens.count >= 3 &&
                first.length === 3 && line.text.substr(first.start, first.length) === 'def' &&
                lineTokens.getItemAt(1).type === types_1.TokenType.Identifier &&
                lineTokens.getItemAt(2).type === types_1.TokenType.OpenBrace) {
                start = line.range.start;
                break;
            }
            if (lineTokens.count > 0 && i < this.lineNumber) {
                // One of previous lines ends with :
                const last = lineTokens.getItemAt(lineTokens.count - 1);
                if (last.type === types_1.TokenType.Colon) {
                    start = this.document.lineAt(i + 1).range.start;
                    break;
                }
                else if (lineTokens.count > 1) {
                    const beforeLast = lineTokens.getItemAt(lineTokens.count - 2);
                    if (beforeLast.type === types_1.TokenType.Colon && last.type === types_1.TokenType.Comment) {
                        start = this.document.lineAt(i + 1).range.start;
                        break;
                    }
                }
            }
        }
        // Now tokenize from the nearest reasonable point
        const currentLine = this.document.lineAt(this.lineNumber);
        const text = this.document.getText(new vscode_1.Range(start, currentLine.range.end));
        const tokens = new tokenizer_1.Tokenizer().tokenize(text);
        // Translate position in the line being formatted to the position in the tokenized block
        position = this.document.offsetAt(currentLine.range.start) + position - this.document.offsetAt(start);
        // Walk tokens locating narrowest function signature as in IDENT( | )
        let funcCallStartIndex = -1;
        let funcCallEndIndex = -1;
        for (let i = 0; i < tokens.count - 1; i += 1) {
            const t = tokens.getItemAt(i);
            if (t.type === types_1.TokenType.Identifier) {
                const next = tokens.getItemAt(i + 1);
                if (next.type === types_1.TokenType.OpenBrace && !this.isKeywordWithSpaceBeforeBrace(text.substr(t.start, t.length))) {
                    // We are at IDENT(, try and locate the closing brace
                    let closeBraceIndex = this.findClosingBrace(tokens, i + 1);
                    // Closing brace is not required in case construct is not yet terminated
                    closeBraceIndex = closeBraceIndex > 0 ? closeBraceIndex : tokens.count - 1;
                    // Are we in range?
                    if (position > next.start && position < tokens.getItemAt(closeBraceIndex).start) {
                        funcCallStartIndex = i;
                        funcCallEndIndex = closeBraceIndex;
                    }
                }
            }
        }
        // Did we find anything?
        if (funcCallStartIndex < 0) {
            // No? See if we are between 'lambda' and ':'
            for (let i = 0; i < tokens.count; i += 1) {
                const t = tokens.getItemAt(i);
                if (t.type === types_1.TokenType.Identifier && text.substr(t.start, t.length) === 'lambda') {
                    if (position < t.start) {
                        break; // Position is before the nearest 'lambda'
                    }
                    let colonIndex = this.findNearestColon(tokens, i + 1);
                    // Closing : is not required in case construct is not yet terminated
                    colonIndex = colonIndex > 0 ? colonIndex : tokens.count - 1;
                    if (position > t.start && position < tokens.getItemAt(colonIndex).start) {
                        funcCallStartIndex = i;
                        funcCallEndIndex = colonIndex;
                    }
                }
            }
        }
        return funcCallStartIndex >= 0 && funcCallEndIndex > 0;
    }
    findNearestColon(tokens, index) {
        for (let i = index; i < tokens.count; i += 1) {
            if (tokens.getItemAt(i).type === types_1.TokenType.Colon) {
                return i;
            }
        }
        return -1;
    }
    findClosingBrace(tokens, index) {
        const braceCounter = new braceCounter_1.BraceCounter();
        for (let i = index; i < tokens.count; i += 1) {
            const t = tokens.getItemAt(i);
            if (t.type === types_1.TokenType.OpenBrace || t.type === types_1.TokenType.CloseBrace) {
                braceCounter.countBrace(t);
            }
            if (braceCounter.count === 0) {
                return i;
            }
        }
        return -1;
    }
    getPreviousLineTokens() {
        if (!this.document || this.lineNumber === 0) {
            return undefined; // unable to determine
        }
        const line = this.document.lineAt(this.lineNumber - 1);
        return new tokenizer_1.Tokenizer().tokenize(line.text);
    }
}
exports.LineFormatter = LineFormatter;
//# sourceMappingURL=lineFormatter.js.map