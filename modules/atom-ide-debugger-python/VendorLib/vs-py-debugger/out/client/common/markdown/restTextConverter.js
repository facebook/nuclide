"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const characters_1 = require("../../language/characters");
var State;
(function (State) {
    State[State["Default"] = 0] = "Default";
    State[State["Preformatted"] = 1] = "Preformatted";
    State[State["Code"] = 2] = "Code";
})(State || (State = {}));
class RestTextConverter {
    constructor() {
        this.state = State.Default;
        this.md = [];
    }
    // tslint:disable-next-line:cyclomatic-complexity
    toMarkdown(docstring) {
        // Translates reStructruredText (Python doc syntax) to markdown.
        // It only translates as much as needed to display tooltips
        // and documentation in the completion list.
        // See https://en.wikipedia.org/wiki/ReStructuredText
        const result = this.transformLines(docstring);
        this.state = State.Default;
        this.md = [];
        return result;
    }
    escapeMarkdown(text) {
        // Not complete escape list so it does not interfere
        // with subsequent code highlighting (see above).
        return text
            .replace(/\#/g, '\\#')
            .replace(/\*/g, '\\*')
            .replace(/\ _/g, ' \\_')
            .replace(/^_/, '\\_');
    }
    transformLines(docstring) {
        const lines = docstring.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            // Avoid leading empty lines
            if (this.md.length === 0 && line.length === 0) {
                continue;
            }
            switch (this.state) {
                case State.Default:
                    i += this.inDefaultState(lines, i);
                    break;
                case State.Preformatted:
                    i += this.inPreformattedState(lines, i);
                    break;
                case State.Code:
                    this.inCodeState(line);
                    break;
                default:
                    break;
            }
        }
        this.endCodeBlock();
        this.endPreformattedBlock();
        return this.md.join(os_1.EOL).trim();
    }
    inDefaultState(lines, i) {
        let line = lines[i];
        if (line.startsWith('```')) {
            this.startCodeBlock();
            return 0;
        }
        if (line.startsWith('===') || line.startsWith('---')) {
            return 0; // Eat standalone === or --- lines.
        }
        if (this.handleDoubleColon(line)) {
            return 0;
        }
        if (this.isIgnorable(line)) {
            return 0;
        }
        if (this.handleSectionHeader(lines, i)) {
            return 1; // Eat line with === or ---
        }
        const result = this.checkPreContent(lines, i);
        if (this.state !== State.Default) {
            return result; // Handle line in the new state
        }
        line = this.cleanup(line);
        line = line.replace(/``/g, '`'); // Convert double backticks to single.
        line = this.escapeMarkdown(line);
        this.md.push(line);
        return 0;
    }
    inPreformattedState(lines, i) {
        let line = lines[i];
        if (this.isIgnorable(line)) {
            return 0;
        }
        // Preformatted block terminates by a line without leading whitespace.
        if (line.length > 0 && !characters_1.isWhiteSpace(line.charCodeAt(0)) && !this.isListItem(line)) {
            this.endPreformattedBlock();
            return -1;
        }
        const prevLine = this.md.length > 0 ? this.md[this.md.length - 1] : undefined;
        if (line.length === 0 && prevLine && (prevLine.length === 0 || prevLine.startsWith('```'))) {
            return 0; // Avoid more than one empty line in a row.
        }
        // Since we use HTML blocks as preformatted text
        // make sure we drop angle brackets since otherwise
        // they will render as tags and attributes
        line = line.replace(/</g, ' ').replace(/>/g, ' ');
        line = line.replace(/``/g, '`'); // Convert double backticks to single.
        // Keep hard line breaks for the preformatted content
        this.md.push(`${line}  `);
        return 0;
    }
    inCodeState(line) {
        const prevLine = this.md.length > 0 ? this.md[this.md.length - 1] : undefined;
        if (line.length === 0 && prevLine && (prevLine.length === 0 || prevLine.startsWith('```'))) {
            return; // Avoid more than one empty line in a row.
        }
        if (line.startsWith('```')) {
            this.endCodeBlock();
        }
        else {
            this.md.push(line);
        }
    }
    isIgnorable(line) {
        if (line.indexOf('generated/') >= 0) {
            return true; // Drop generated content.
        }
        const trimmed = line.trim();
        if (trimmed.startsWith('..') && trimmed.indexOf('::') > 0) {
            // Ignore lines likes .. sectionauthor:: John Doe.
            return true;
        }
        return false;
    }
    checkPreContent(lines, i) {
        const line = lines[i];
        if (i === 0 || line.trim().length === 0) {
            return 0;
        }
        if (!characters_1.isWhiteSpace(line.charCodeAt(0)) && !this.isListItem(line)) {
            return 0; // regular line, nothing to do here.
        }
        // Indented content is considered to be preformatted.
        this.startPreformattedBlock();
        return -1;
    }
    handleSectionHeader(lines, i) {
        const line = lines[i];
        if (i < lines.length - 1 && (lines[i + 1].startsWith('==='))) {
            // Section title -> heading level 3.
            this.md.push(`### ${this.cleanup(line)}`);
            return true;
        }
        if (i < lines.length - 1 && (lines[i + 1].startsWith('---'))) {
            // Subsection title -> heading level 4.
            this.md.push(`#### ${this.cleanup(line)}`);
            return true;
        }
        return false;
    }
    handleDoubleColon(line) {
        if (!line.endsWith('::')) {
            return false;
        }
        // Literal blocks begin with `::`. Such as sequence like
        // '... as shown below::' that is followed by a preformatted text.
        if (line.length > 2 && !line.startsWith('..')) {
            // Ignore lines likes .. autosummary:: John Doe.
            // Trim trailing : so :: turns into :.
            this.md.push(line.substring(0, line.length - 1));
        }
        this.startPreformattedBlock();
        return true;
    }
    startPreformattedBlock() {
        // Remove previous empty line so we avoid double empties.
        this.tryRemovePrecedingEmptyLines();
        // Lie about the language since we don't want preformatted text
        // to be colorized as Python. HTML is more 'appropriate' as it does
        // not colorize -- or + or keywords like 'from'.
        this.md.push('```html');
        this.state = State.Preformatted;
    }
    endPreformattedBlock() {
        if (this.state === State.Preformatted) {
            this.tryRemovePrecedingEmptyLines();
            this.md.push('```');
            this.state = State.Default;
        }
    }
    startCodeBlock() {
        // Remove previous empty line so we avoid double empties.
        this.tryRemovePrecedingEmptyLines();
        this.md.push('```python');
        this.state = State.Code;
    }
    endCodeBlock() {
        if (this.state === State.Code) {
            this.tryRemovePrecedingEmptyLines();
            this.md.push('```');
            this.state = State.Default;
        }
    }
    tryRemovePrecedingEmptyLines() {
        while (this.md.length > 0 && this.md[this.md.length - 1].trim().length === 0) {
            this.md.pop();
        }
    }
    isListItem(line) {
        const trimmed = line.trim();
        const ch = trimmed.length > 0 ? trimmed.charCodeAt(0) : 0;
        return ch === 42 /* Asterisk */ || ch === 45 /* Hyphen */ || characters_1.isDecimal(ch);
    }
    cleanup(line) {
        return line.replace(/:mod:/g, 'module:');
    }
}
exports.RestTextConverter = RestTextConverter;
//# sourceMappingURL=restTextConverter.js.map