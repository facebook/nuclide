/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// import * as crypto from 'crypto';
// tslint:disable:all
const path_1 = require("path");
const htmlContent_1 = require("./htmlContent");
const strings_1 = require("./strings");
const uri_1 = require("./uri");
var vscMockExtHostedTypes;
(function (vscMockExtHostedTypes) {
    // tslint:disable:all
    const illegalArgument = (msg = 'Illegal Argument') => new Error(msg);
    class Disposable {
        constructor(callOnDispose) {
            this._callOnDispose = callOnDispose;
        }
        static from(...disposables) {
            return new Disposable(function () {
                if (disposables) {
                    for (let disposable of disposables) {
                        if (disposable && typeof disposable.dispose === 'function') {
                            disposable.dispose();
                        }
                    }
                    disposables = undefined;
                }
            });
        }
        dispose() {
            if (typeof this._callOnDispose === 'function') {
                this._callOnDispose();
                this._callOnDispose = undefined;
            }
        }
    }
    vscMockExtHostedTypes.Disposable = Disposable;
    class Position {
        constructor(line, character) {
            if (line < 0) {
                throw illegalArgument('line must be non-negative');
            }
            if (character < 0) {
                throw illegalArgument('character must be non-negative');
            }
            this._line = line;
            this._character = character;
        }
        static Min(...positions) {
            let result = positions.pop();
            for (let p of positions) {
                if (p.isBefore(result)) {
                    result = p;
                }
            }
            return result;
        }
        static Max(...positions) {
            let result = positions.pop();
            for (let p of positions) {
                if (p.isAfter(result)) {
                    result = p;
                }
            }
            return result;
        }
        static isPosition(other) {
            if (!other) {
                return false;
            }
            if (other instanceof Position) {
                return true;
            }
            let { line, character } = other;
            if (typeof line === 'number' && typeof character === 'number') {
                return true;
            }
            return false;
        }
        get line() {
            return this._line;
        }
        get character() {
            return this._character;
        }
        isBefore(other) {
            if (this._line < other._line) {
                return true;
            }
            if (other._line < this._line) {
                return false;
            }
            return this._character < other._character;
        }
        isBeforeOrEqual(other) {
            if (this._line < other._line) {
                return true;
            }
            if (other._line < this._line) {
                return false;
            }
            return this._character <= other._character;
        }
        isAfter(other) {
            return !this.isBeforeOrEqual(other);
        }
        isAfterOrEqual(other) {
            return !this.isBefore(other);
        }
        isEqual(other) {
            return this._line === other._line && this._character === other._character;
        }
        compareTo(other) {
            if (this._line < other._line) {
                return -1;
            }
            else if (this._line > other.line) {
                return 1;
            }
            else {
                // equal line
                if (this._character < other._character) {
                    return -1;
                }
                else if (this._character > other._character) {
                    return 1;
                }
                else {
                    // equal line and character
                    return 0;
                }
            }
        }
        translate(lineDeltaOrChange, characterDelta = 0) {
            if (lineDeltaOrChange === null || characterDelta === null) {
                throw illegalArgument();
            }
            let lineDelta;
            if (typeof lineDeltaOrChange === 'undefined') {
                lineDelta = 0;
            }
            else if (typeof lineDeltaOrChange === 'number') {
                lineDelta = lineDeltaOrChange;
            }
            else {
                lineDelta = typeof lineDeltaOrChange.lineDelta === 'number' ? lineDeltaOrChange.lineDelta : 0;
                characterDelta = typeof lineDeltaOrChange.characterDelta === 'number' ? lineDeltaOrChange.characterDelta : 0;
            }
            if (lineDelta === 0 && characterDelta === 0) {
                return this;
            }
            return new Position(this.line + lineDelta, this.character + characterDelta);
        }
        with(lineOrChange, character = this.character) {
            if (lineOrChange === null || character === null) {
                throw illegalArgument();
            }
            let line;
            if (typeof lineOrChange === 'undefined') {
                line = this.line;
            }
            else if (typeof lineOrChange === 'number') {
                line = lineOrChange;
            }
            else {
                line = typeof lineOrChange.line === 'number' ? lineOrChange.line : this.line;
                character = typeof lineOrChange.character === 'number' ? lineOrChange.character : this.character;
            }
            if (line === this.line && character === this.character) {
                return this;
            }
            return new Position(line, character);
        }
        toJSON() {
            return { line: this.line, character: this.character };
        }
    }
    vscMockExtHostedTypes.Position = Position;
    class Range {
        constructor(startLineOrStart, startColumnOrEnd, endLine, endColumn) {
            let start;
            let end;
            if (typeof startLineOrStart === 'number' && typeof startColumnOrEnd === 'number' && typeof endLine === 'number' && typeof endColumn === 'number') {
                start = new Position(startLineOrStart, startColumnOrEnd);
                end = new Position(endLine, endColumn);
            }
            else if (startLineOrStart instanceof Position && startColumnOrEnd instanceof Position) {
                start = startLineOrStart;
                end = startColumnOrEnd;
            }
            if (!start || !end) {
                throw new Error('Invalid arguments');
            }
            if (start.isBefore(end)) {
                this._start = start;
                this._end = end;
            }
            else {
                this._start = end;
                this._end = start;
            }
        }
        static isRange(thing) {
            if (thing instanceof Range) {
                return true;
            }
            if (!thing) {
                return false;
            }
            return Position.isPosition(thing.start)
                && Position.isPosition(thing.end);
        }
        get start() {
            return this._start;
        }
        get end() {
            return this._end;
        }
        contains(positionOrRange) {
            if (positionOrRange instanceof Range) {
                return this.contains(positionOrRange._start)
                    && this.contains(positionOrRange._end);
            }
            else if (positionOrRange instanceof Position) {
                if (positionOrRange.isBefore(this._start)) {
                    return false;
                }
                if (this._end.isBefore(positionOrRange)) {
                    return false;
                }
                return true;
            }
            return false;
        }
        isEqual(other) {
            return this._start.isEqual(other._start) && this._end.isEqual(other._end);
        }
        intersection(other) {
            let start = Position.Max(other.start, this._start);
            let end = Position.Min(other.end, this._end);
            if (start.isAfter(end)) {
                // this happens when there is no overlap:
                // |-----|
                //          |----|
                return undefined;
            }
            return new Range(start, end);
        }
        union(other) {
            if (this.contains(other)) {
                return this;
            }
            else if (other.contains(this)) {
                return other;
            }
            let start = Position.Min(other.start, this._start);
            let end = Position.Max(other.end, this.end);
            return new Range(start, end);
        }
        get isEmpty() {
            return this._start.isEqual(this._end);
        }
        get isSingleLine() {
            return this._start.line === this._end.line;
        }
        with(startOrChange, end = this.end) {
            if (startOrChange === null || end === null) {
                throw illegalArgument();
            }
            let start;
            if (!startOrChange) {
                start = this.start;
            }
            else if (Position.isPosition(startOrChange)) {
                start = startOrChange;
            }
            else {
                start = startOrChange.start || this.start;
                end = startOrChange.end || this.end;
            }
            if (start.isEqual(this._start) && end.isEqual(this.end)) {
                return this;
            }
            return new Range(start, end);
        }
        toJSON() {
            return [this.start, this.end];
        }
    }
    vscMockExtHostedTypes.Range = Range;
    class Selection extends Range {
        constructor(anchorLineOrAnchor, anchorColumnOrActive, activeLine, activeColumn) {
            let anchor;
            let active;
            if (typeof anchorLineOrAnchor === 'number' && typeof anchorColumnOrActive === 'number' && typeof activeLine === 'number' && typeof activeColumn === 'number') {
                anchor = new Position(anchorLineOrAnchor, anchorColumnOrActive);
                active = new Position(activeLine, activeColumn);
            }
            else if (anchorLineOrAnchor instanceof Position && anchorColumnOrActive instanceof Position) {
                anchor = anchorLineOrAnchor;
                active = anchorColumnOrActive;
            }
            if (!anchor || !active) {
                throw new Error('Invalid arguments');
            }
            super(anchor, active);
            this._anchor = anchor;
            this._active = active;
        }
        static isSelection(thing) {
            if (thing instanceof Selection) {
                return true;
            }
            if (!thing) {
                return false;
            }
            return Range.isRange(thing)
                && Position.isPosition(thing.anchor)
                && Position.isPosition(thing.active)
                && typeof thing.isReversed === 'boolean';
        }
        get anchor() {
            return this._anchor;
        }
        get active() {
            return this._active;
        }
        get isReversed() {
            return this._anchor === this._end;
        }
        toJSON() {
            return {
                start: this.start,
                end: this.end,
                active: this.active,
                anchor: this.anchor
            };
        }
    }
    vscMockExtHostedTypes.Selection = Selection;
    let EndOfLine;
    (function (EndOfLine) {
        EndOfLine[EndOfLine["LF"] = 1] = "LF";
        EndOfLine[EndOfLine["CRLF"] = 2] = "CRLF";
    })(EndOfLine = vscMockExtHostedTypes.EndOfLine || (vscMockExtHostedTypes.EndOfLine = {}));
    class TextEdit {
        constructor(range, newText) {
            this.range = range;
            this.newText = newText;
        }
        static isTextEdit(thing) {
            if (thing instanceof TextEdit) {
                return true;
            }
            if (!thing) {
                return false;
            }
            return Range.isRange(thing)
                && typeof thing.newText === 'string';
        }
        static replace(range, newText) {
            return new TextEdit(range, newText);
        }
        static insert(position, newText) {
            return TextEdit.replace(new Range(position, position), newText);
        }
        static delete(range) {
            return TextEdit.replace(range, '');
        }
        static setEndOfLine(eol) {
            let ret = new TextEdit(undefined, undefined);
            ret.newEol = eol;
            return ret;
        }
        get range() {
            return this._range;
        }
        set range(value) {
            if (value && !Range.isRange(value)) {
                throw illegalArgument('range');
            }
            this._range = value;
        }
        get newText() {
            return this._newText || '';
        }
        set newText(value) {
            if (value && typeof value !== 'string') {
                throw illegalArgument('newText');
            }
            this._newText = value;
        }
        get newEol() {
            return this._newEol;
        }
        set newEol(value) {
            if (value && typeof value !== 'number') {
                throw illegalArgument('newEol');
            }
            this._newEol = value;
        }
        toJSON() {
            return {
                range: this.range,
                newText: this.newText,
                newEol: this._newEol
            };
        }
    }
    vscMockExtHostedTypes.TextEdit = TextEdit;
    class WorkspaceEdit {
        constructor() {
            this._seqPool = 0;
            this._resourceEdits = [];
            this._textEdits = new Map();
        }
        // createResource(uri: vscode.Uri): void {
        // 	this.renameResource(undefined, uri);
        // }
        // deleteResource(uri: vscode.Uri): void {
        // 	this.renameResource(uri, undefined);
        // }
        // renameResource(from: vscode.Uri, to: vscode.Uri): void {
        // 	this._resourceEdits.push({ seq: this._seqPool++, from, to });
        // }
        // resourceEdits(): [vscode.Uri, vscode.Uri][] {
        // 	return this._resourceEdits.map(({ from, to }) => (<[vscode.Uri, vscode.Uri]>[from, to]));
        // }
        createFile(uri, options) {
            throw new Error("Method not implemented.");
        }
        deleteFile(uri, options) {
            throw new Error("Method not implemented.");
        }
        renameFile(oldUri, newUri, options) {
            throw new Error("Method not implemented.");
        }
        replace(uri, range, newText) {
            let edit = new TextEdit(range, newText);
            let array = this.get(uri);
            if (array) {
                array.push(edit);
            }
            else {
                array = [edit];
            }
            this.set(uri, array);
        }
        insert(resource, position, newText) {
            this.replace(resource, new Range(position, position), newText);
        }
        delete(resource, range) {
            this.replace(resource, range, '');
        }
        has(uri) {
            return this._textEdits.has(uri.toString());
        }
        set(uri, edits) {
            let data = this._textEdits.get(uri.toString());
            if (!data) {
                data = { seq: this._seqPool++, uri, edits: [] };
                this._textEdits.set(uri.toString(), data);
            }
            if (!edits) {
                data.edits = undefined;
            }
            else {
                data.edits = edits.slice(0);
            }
        }
        get(uri) {
            if (!this._textEdits.has(uri.toString())) {
                return undefined;
            }
            const { edits } = this._textEdits.get(uri.toString());
            return edits ? edits.slice() : undefined;
        }
        entries() {
            const res = [];
            this._textEdits.forEach(value => res.push([value.uri, value.edits]));
            return res.slice();
        }
        allEntries() {
            return this.entries();
            // 	// use the 'seq' the we have assigned when inserting
            // 	// the operation and use that order in the resulting
            // 	// array
            // 	const res: ([vscUri.URI, TextEdit[]] | [vscUri.URI,vscUri.URI])[] = [];
            // 	this._textEdits.forEach(value => {
            // 		const { seq, uri, edits } = value;
            // 		res[seq] = [uri, edits];
            // 	});
            // 	this._resourceEdits.forEach(value => {
            // 		const { seq, from, to } = value;
            // 		res[seq] = [from, to];
            // 	});
            // 	return res;
        }
        get size() {
            return this._textEdits.size + this._resourceEdits.length;
        }
        toJSON() {
            return this.entries();
        }
    }
    vscMockExtHostedTypes.WorkspaceEdit = WorkspaceEdit;
    class SnippetString {
        constructor(value) {
            this._tabstop = 1;
            this.value = value || '';
        }
        static isSnippetString(thing) {
            if (thing instanceof SnippetString) {
                return true;
            }
            if (!thing) {
                return false;
            }
            return typeof thing.value === 'string';
        }
        static _escape(value) {
            return value.replace(/\$|}|\\/g, '\\$&');
        }
        appendText(string) {
            this.value += SnippetString._escape(string);
            return this;
        }
        appendTabstop(number = this._tabstop++) {
            this.value += '$';
            this.value += number;
            return this;
        }
        appendPlaceholder(value, number = this._tabstop++) {
            if (typeof value === 'function') {
                const nested = new SnippetString();
                nested._tabstop = this._tabstop;
                value(nested);
                this._tabstop = nested._tabstop;
                value = nested.value;
            }
            else {
                value = SnippetString._escape(value);
            }
            this.value += '${';
            this.value += number;
            this.value += ':';
            this.value += value;
            this.value += '}';
            return this;
        }
        appendVariable(name, defaultValue) {
            if (typeof defaultValue === 'function') {
                const nested = new SnippetString();
                nested._tabstop = this._tabstop;
                defaultValue(nested);
                this._tabstop = nested._tabstop;
                defaultValue = nested.value;
            }
            else if (typeof defaultValue === 'string') {
                defaultValue = defaultValue.replace(/\$|}/g, '\\$&');
            }
            this.value += '${';
            this.value += name;
            if (defaultValue) {
                this.value += ':';
                this.value += defaultValue;
            }
            this.value += '}';
            return this;
        }
    }
    vscMockExtHostedTypes.SnippetString = SnippetString;
    let DiagnosticTag;
    (function (DiagnosticTag) {
        DiagnosticTag[DiagnosticTag["Unnecessary"] = 1] = "Unnecessary";
    })(DiagnosticTag = vscMockExtHostedTypes.DiagnosticTag || (vscMockExtHostedTypes.DiagnosticTag = {}));
    let DiagnosticSeverity;
    (function (DiagnosticSeverity) {
        DiagnosticSeverity[DiagnosticSeverity["Hint"] = 3] = "Hint";
        DiagnosticSeverity[DiagnosticSeverity["Information"] = 2] = "Information";
        DiagnosticSeverity[DiagnosticSeverity["Warning"] = 1] = "Warning";
        DiagnosticSeverity[DiagnosticSeverity["Error"] = 0] = "Error";
    })(DiagnosticSeverity = vscMockExtHostedTypes.DiagnosticSeverity || (vscMockExtHostedTypes.DiagnosticSeverity = {}));
    class Location {
        constructor(uri, rangeOrPosition) {
            this.uri = uri;
            if (!rangeOrPosition) {
                //that's OK
            }
            else if (rangeOrPosition instanceof Range) {
                this.range = rangeOrPosition;
            }
            else if (rangeOrPosition instanceof Position) {
                this.range = new Range(rangeOrPosition, rangeOrPosition);
            }
            else {
                throw new Error('Illegal argument');
            }
        }
        static isLocation(thing) {
            if (thing instanceof Location) {
                return true;
            }
            if (!thing) {
                return false;
            }
            return Range.isRange(thing.range)
                && uri_1.vscUri.URI.isUri(thing.uri);
        }
        toJSON() {
            return {
                uri: this.uri,
                range: this.range
            };
        }
    }
    vscMockExtHostedTypes.Location = Location;
    class DiagnosticRelatedInformation {
        constructor(location, message) {
            this.location = location;
            this.message = message;
        }
        static is(thing) {
            if (!thing) {
                return false;
            }
            return typeof thing.message === 'string'
                && thing.location
                && Range.isRange(thing.location.range)
                && uri_1.vscUri.URI.isUri(thing.location.uri);
        }
    }
    vscMockExtHostedTypes.DiagnosticRelatedInformation = DiagnosticRelatedInformation;
    class Diagnostic {
        constructor(range, message, severity = DiagnosticSeverity.Error) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        }
        toJSON() {
            return {
                severity: DiagnosticSeverity[this.severity],
                message: this.message,
                range: this.range,
                source: this.source,
                code: this.code,
            };
        }
    }
    vscMockExtHostedTypes.Diagnostic = Diagnostic;
    class Hover {
        constructor(contents, range) {
            if (!contents) {
                throw new Error('Illegal argument, contents must be defined');
            }
            if (Array.isArray(contents)) {
                this.contents = contents;
            }
            else if (htmlContent_1.vscMockHtmlContent.isMarkdownString(contents)) {
                this.contents = [contents];
            }
            else {
                this.contents = [contents];
            }
            this.range = range;
        }
    }
    vscMockExtHostedTypes.Hover = Hover;
    let DocumentHighlightKind;
    (function (DocumentHighlightKind) {
        DocumentHighlightKind[DocumentHighlightKind["Text"] = 0] = "Text";
        DocumentHighlightKind[DocumentHighlightKind["Read"] = 1] = "Read";
        DocumentHighlightKind[DocumentHighlightKind["Write"] = 2] = "Write";
    })(DocumentHighlightKind = vscMockExtHostedTypes.DocumentHighlightKind || (vscMockExtHostedTypes.DocumentHighlightKind = {}));
    class DocumentHighlight {
        constructor(range, kind = DocumentHighlightKind.Text) {
            this.range = range;
            this.kind = kind;
        }
        toJSON() {
            return {
                range: this.range,
                kind: DocumentHighlightKind[this.kind]
            };
        }
    }
    vscMockExtHostedTypes.DocumentHighlight = DocumentHighlight;
    let SymbolKind;
    (function (SymbolKind) {
        SymbolKind[SymbolKind["File"] = 0] = "File";
        SymbolKind[SymbolKind["Module"] = 1] = "Module";
        SymbolKind[SymbolKind["Namespace"] = 2] = "Namespace";
        SymbolKind[SymbolKind["Package"] = 3] = "Package";
        SymbolKind[SymbolKind["Class"] = 4] = "Class";
        SymbolKind[SymbolKind["Method"] = 5] = "Method";
        SymbolKind[SymbolKind["Property"] = 6] = "Property";
        SymbolKind[SymbolKind["Field"] = 7] = "Field";
        SymbolKind[SymbolKind["Constructor"] = 8] = "Constructor";
        SymbolKind[SymbolKind["Enum"] = 9] = "Enum";
        SymbolKind[SymbolKind["Interface"] = 10] = "Interface";
        SymbolKind[SymbolKind["Function"] = 11] = "Function";
        SymbolKind[SymbolKind["Variable"] = 12] = "Variable";
        SymbolKind[SymbolKind["Constant"] = 13] = "Constant";
        SymbolKind[SymbolKind["String"] = 14] = "String";
        SymbolKind[SymbolKind["Number"] = 15] = "Number";
        SymbolKind[SymbolKind["Boolean"] = 16] = "Boolean";
        SymbolKind[SymbolKind["Array"] = 17] = "Array";
        SymbolKind[SymbolKind["Object"] = 18] = "Object";
        SymbolKind[SymbolKind["Key"] = 19] = "Key";
        SymbolKind[SymbolKind["Null"] = 20] = "Null";
        SymbolKind[SymbolKind["EnumMember"] = 21] = "EnumMember";
        SymbolKind[SymbolKind["Struct"] = 22] = "Struct";
        SymbolKind[SymbolKind["Event"] = 23] = "Event";
        SymbolKind[SymbolKind["Operator"] = 24] = "Operator";
        SymbolKind[SymbolKind["TypeParameter"] = 25] = "TypeParameter";
    })(SymbolKind = vscMockExtHostedTypes.SymbolKind || (vscMockExtHostedTypes.SymbolKind = {}));
    class SymbolInformation {
        constructor(name, kind, rangeOrContainer, locationOrUri, containerName) {
            this.name = name;
            this.kind = kind;
            this.containerName = containerName;
            if (typeof rangeOrContainer === 'string') {
                this.containerName = rangeOrContainer;
            }
            if (locationOrUri instanceof Location) {
                this.location = locationOrUri;
            }
            else if (rangeOrContainer instanceof Range) {
                this.location = new Location(locationOrUri, rangeOrContainer);
            }
        }
        toJSON() {
            return {
                name: this.name,
                kind: SymbolKind[this.kind],
                location: this.location,
                containerName: this.containerName
            };
        }
    }
    vscMockExtHostedTypes.SymbolInformation = SymbolInformation;
    class SymbolInformation2 extends SymbolInformation {
        constructor(name, kind, containerName, location) {
            super(name, kind, containerName, location);
            this.children = [];
            this.definingRange = location.range;
        }
    }
    vscMockExtHostedTypes.SymbolInformation2 = SymbolInformation2;
    let CodeActionTrigger;
    (function (CodeActionTrigger) {
        CodeActionTrigger[CodeActionTrigger["Automatic"] = 1] = "Automatic";
        CodeActionTrigger[CodeActionTrigger["Manual"] = 2] = "Manual";
    })(CodeActionTrigger = vscMockExtHostedTypes.CodeActionTrigger || (vscMockExtHostedTypes.CodeActionTrigger = {}));
    class CodeAction {
        constructor(title, kind) {
            this.title = title;
            this.kind = kind;
        }
    }
    vscMockExtHostedTypes.CodeAction = CodeAction;
    class CodeActionKind {
        constructor(value) {
            this.value = value;
        }
        append(parts) {
            return new CodeActionKind(this.value ? this.value + CodeActionKind.sep + parts : parts);
        }
        contains(other) {
            return this.value === other.value || strings_1.vscMockStrings.startsWith(other.value, this.value + CodeActionKind.sep);
        }
    }
    CodeActionKind.sep = '.';
    CodeActionKind.Empty = new CodeActionKind('');
    CodeActionKind.QuickFix = CodeActionKind.Empty.append('quickfix');
    CodeActionKind.Refactor = CodeActionKind.Empty.append('refactor');
    CodeActionKind.RefactorExtract = CodeActionKind.Refactor.append('extract');
    CodeActionKind.RefactorInline = CodeActionKind.Refactor.append('inline');
    CodeActionKind.RefactorRewrite = CodeActionKind.Refactor.append('rewrite');
    CodeActionKind.Source = CodeActionKind.Empty.append('source');
    CodeActionKind.SourceOrganizeImports = CodeActionKind.Source.append('organizeImports');
    vscMockExtHostedTypes.CodeActionKind = CodeActionKind;
    class CodeLens {
        constructor(range, command) {
            this.range = range;
            this.command = command;
        }
        get isResolved() {
            return !!this.command;
        }
    }
    vscMockExtHostedTypes.CodeLens = CodeLens;
    class MarkdownString {
        constructor(value) {
            this.value = value || '';
        }
        appendText(value) {
            // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
            this.value += value.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
            return this;
        }
        appendMarkdown(value) {
            this.value += value;
            return this;
        }
        appendCodeblock(code, language = '') {
            this.value += '\n```';
            this.value += language;
            this.value += '\n';
            this.value += code;
            this.value += '\n```\n';
            return this;
        }
    }
    vscMockExtHostedTypes.MarkdownString = MarkdownString;
    class ParameterInformation {
        constructor(label, documentation) {
            this.label = label;
            this.documentation = documentation;
        }
    }
    vscMockExtHostedTypes.ParameterInformation = ParameterInformation;
    class SignatureInformation {
        constructor(label, documentation) {
            this.label = label;
            this.documentation = documentation;
            this.parameters = [];
        }
    }
    vscMockExtHostedTypes.SignatureInformation = SignatureInformation;
    class SignatureHelp {
        constructor() {
            this.signatures = [];
        }
    }
    vscMockExtHostedTypes.SignatureHelp = SignatureHelp;
    let CompletionTriggerKind;
    (function (CompletionTriggerKind) {
        CompletionTriggerKind[CompletionTriggerKind["Invoke"] = 0] = "Invoke";
        CompletionTriggerKind[CompletionTriggerKind["TriggerCharacter"] = 1] = "TriggerCharacter";
        CompletionTriggerKind[CompletionTriggerKind["TriggerForIncompleteCompletions"] = 2] = "TriggerForIncompleteCompletions";
    })(CompletionTriggerKind = vscMockExtHostedTypes.CompletionTriggerKind || (vscMockExtHostedTypes.CompletionTriggerKind = {}));
    let CompletionItemKind;
    (function (CompletionItemKind) {
        CompletionItemKind[CompletionItemKind["Text"] = 0] = "Text";
        CompletionItemKind[CompletionItemKind["Method"] = 1] = "Method";
        CompletionItemKind[CompletionItemKind["Function"] = 2] = "Function";
        CompletionItemKind[CompletionItemKind["Constructor"] = 3] = "Constructor";
        CompletionItemKind[CompletionItemKind["Field"] = 4] = "Field";
        CompletionItemKind[CompletionItemKind["Variable"] = 5] = "Variable";
        CompletionItemKind[CompletionItemKind["Class"] = 6] = "Class";
        CompletionItemKind[CompletionItemKind["Interface"] = 7] = "Interface";
        CompletionItemKind[CompletionItemKind["Module"] = 8] = "Module";
        CompletionItemKind[CompletionItemKind["Property"] = 9] = "Property";
        CompletionItemKind[CompletionItemKind["Unit"] = 10] = "Unit";
        CompletionItemKind[CompletionItemKind["Value"] = 11] = "Value";
        CompletionItemKind[CompletionItemKind["Enum"] = 12] = "Enum";
        CompletionItemKind[CompletionItemKind["Keyword"] = 13] = "Keyword";
        CompletionItemKind[CompletionItemKind["Snippet"] = 14] = "Snippet";
        CompletionItemKind[CompletionItemKind["Color"] = 15] = "Color";
        CompletionItemKind[CompletionItemKind["File"] = 16] = "File";
        CompletionItemKind[CompletionItemKind["Reference"] = 17] = "Reference";
        CompletionItemKind[CompletionItemKind["Folder"] = 18] = "Folder";
        CompletionItemKind[CompletionItemKind["EnumMember"] = 19] = "EnumMember";
        CompletionItemKind[CompletionItemKind["Constant"] = 20] = "Constant";
        CompletionItemKind[CompletionItemKind["Struct"] = 21] = "Struct";
        CompletionItemKind[CompletionItemKind["Event"] = 22] = "Event";
        CompletionItemKind[CompletionItemKind["Operator"] = 23] = "Operator";
        CompletionItemKind[CompletionItemKind["TypeParameter"] = 24] = "TypeParameter";
    })(CompletionItemKind = vscMockExtHostedTypes.CompletionItemKind || (vscMockExtHostedTypes.CompletionItemKind = {}));
    class CompletionItem {
        constructor(label, kind) {
            this.label = label;
            this.kind = kind;
        }
        toJSON() {
            return {
                label: this.label,
                kind: CompletionItemKind[this.kind],
                detail: this.detail,
                documentation: this.documentation,
                sortText: this.sortText,
                filterText: this.filterText,
                insertText: this.insertText,
                textEdit: this.textEdit
            };
        }
    }
    vscMockExtHostedTypes.CompletionItem = CompletionItem;
    class CompletionList {
        constructor(items = [], isIncomplete = false) {
            this.items = items;
            this.isIncomplete = isIncomplete;
        }
    }
    vscMockExtHostedTypes.CompletionList = CompletionList;
    let ViewColumn;
    (function (ViewColumn) {
        ViewColumn[ViewColumn["Active"] = -1] = "Active";
        ViewColumn[ViewColumn["One"] = 1] = "One";
        ViewColumn[ViewColumn["Two"] = 2] = "Two";
        ViewColumn[ViewColumn["Three"] = 3] = "Three";
    })(ViewColumn = vscMockExtHostedTypes.ViewColumn || (vscMockExtHostedTypes.ViewColumn = {}));
    let StatusBarAlignment;
    (function (StatusBarAlignment) {
        StatusBarAlignment[StatusBarAlignment["Left"] = 1] = "Left";
        StatusBarAlignment[StatusBarAlignment["Right"] = 2] = "Right";
    })(StatusBarAlignment = vscMockExtHostedTypes.StatusBarAlignment || (vscMockExtHostedTypes.StatusBarAlignment = {}));
    let TextEditorLineNumbersStyle;
    (function (TextEditorLineNumbersStyle) {
        TextEditorLineNumbersStyle[TextEditorLineNumbersStyle["Off"] = 0] = "Off";
        TextEditorLineNumbersStyle[TextEditorLineNumbersStyle["On"] = 1] = "On";
        TextEditorLineNumbersStyle[TextEditorLineNumbersStyle["Relative"] = 2] = "Relative";
    })(TextEditorLineNumbersStyle = vscMockExtHostedTypes.TextEditorLineNumbersStyle || (vscMockExtHostedTypes.TextEditorLineNumbersStyle = {}));
    let TextDocumentSaveReason;
    (function (TextDocumentSaveReason) {
        TextDocumentSaveReason[TextDocumentSaveReason["Manual"] = 1] = "Manual";
        TextDocumentSaveReason[TextDocumentSaveReason["AfterDelay"] = 2] = "AfterDelay";
        TextDocumentSaveReason[TextDocumentSaveReason["FocusOut"] = 3] = "FocusOut";
    })(TextDocumentSaveReason = vscMockExtHostedTypes.TextDocumentSaveReason || (vscMockExtHostedTypes.TextDocumentSaveReason = {}));
    let TextEditorRevealType;
    (function (TextEditorRevealType) {
        TextEditorRevealType[TextEditorRevealType["Default"] = 0] = "Default";
        TextEditorRevealType[TextEditorRevealType["InCenter"] = 1] = "InCenter";
        TextEditorRevealType[TextEditorRevealType["InCenterIfOutsideViewport"] = 2] = "InCenterIfOutsideViewport";
        TextEditorRevealType[TextEditorRevealType["AtTop"] = 3] = "AtTop";
    })(TextEditorRevealType = vscMockExtHostedTypes.TextEditorRevealType || (vscMockExtHostedTypes.TextEditorRevealType = {}));
    let TextEditorSelectionChangeKind;
    (function (TextEditorSelectionChangeKind) {
        TextEditorSelectionChangeKind[TextEditorSelectionChangeKind["Keyboard"] = 1] = "Keyboard";
        TextEditorSelectionChangeKind[TextEditorSelectionChangeKind["Mouse"] = 2] = "Mouse";
        TextEditorSelectionChangeKind[TextEditorSelectionChangeKind["Command"] = 3] = "Command";
    })(TextEditorSelectionChangeKind = vscMockExtHostedTypes.TextEditorSelectionChangeKind || (vscMockExtHostedTypes.TextEditorSelectionChangeKind = {}));
    /**
     * These values match very carefully the values of `TrackedRangeStickiness`
     */
    let DecorationRangeBehavior;
    (function (DecorationRangeBehavior) {
        /**
         * TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
         */
        DecorationRangeBehavior[DecorationRangeBehavior["OpenOpen"] = 0] = "OpenOpen";
        /**
         * TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
         */
        DecorationRangeBehavior[DecorationRangeBehavior["ClosedClosed"] = 1] = "ClosedClosed";
        /**
         * TrackedRangeStickiness.GrowsOnlyWhenTypingBefore
         */
        DecorationRangeBehavior[DecorationRangeBehavior["OpenClosed"] = 2] = "OpenClosed";
        /**
         * TrackedRangeStickiness.GrowsOnlyWhenTypingAfter
         */
        DecorationRangeBehavior[DecorationRangeBehavior["ClosedOpen"] = 3] = "ClosedOpen";
    })(DecorationRangeBehavior = vscMockExtHostedTypes.DecorationRangeBehavior || (vscMockExtHostedTypes.DecorationRangeBehavior = {}));
    (function (TextEditorSelectionChangeKind) {
        function fromValue(s) {
            switch (s) {
                case 'keyboard': return TextEditorSelectionChangeKind.Keyboard;
                case 'mouse': return TextEditorSelectionChangeKind.Mouse;
                case 'api': return TextEditorSelectionChangeKind.Command;
            }
            return undefined;
        }
        TextEditorSelectionChangeKind.fromValue = fromValue;
    })(TextEditorSelectionChangeKind = vscMockExtHostedTypes.TextEditorSelectionChangeKind || (vscMockExtHostedTypes.TextEditorSelectionChangeKind = {}));
    class DocumentLink {
        constructor(range, target) {
            if (target && !(target instanceof uri_1.vscUri.URI)) {
                throw illegalArgument('target');
            }
            if (!Range.isRange(range) || range.isEmpty) {
                throw illegalArgument('range');
            }
            this.range = range;
            this.target = target;
        }
    }
    vscMockExtHostedTypes.DocumentLink = DocumentLink;
    class Color {
        constructor(red, green, blue, alpha) {
            this.red = red;
            this.green = green;
            this.blue = blue;
            this.alpha = alpha;
        }
    }
    vscMockExtHostedTypes.Color = Color;
    class ColorInformation {
        constructor(range, color) {
            if (color && !(color instanceof Color)) {
                throw illegalArgument('color');
            }
            if (!Range.isRange(range) || range.isEmpty) {
                throw illegalArgument('range');
            }
            this.range = range;
            this.color = color;
        }
    }
    vscMockExtHostedTypes.ColorInformation = ColorInformation;
    class ColorPresentation {
        constructor(label) {
            if (!label || typeof label !== 'string') {
                throw illegalArgument('label');
            }
            this.label = label;
        }
    }
    vscMockExtHostedTypes.ColorPresentation = ColorPresentation;
    let ColorFormat;
    (function (ColorFormat) {
        ColorFormat[ColorFormat["RGB"] = 0] = "RGB";
        ColorFormat[ColorFormat["HEX"] = 1] = "HEX";
        ColorFormat[ColorFormat["HSL"] = 2] = "HSL";
    })(ColorFormat = vscMockExtHostedTypes.ColorFormat || (vscMockExtHostedTypes.ColorFormat = {}));
    let SourceControlInputBoxValidationType;
    (function (SourceControlInputBoxValidationType) {
        SourceControlInputBoxValidationType[SourceControlInputBoxValidationType["Error"] = 0] = "Error";
        SourceControlInputBoxValidationType[SourceControlInputBoxValidationType["Warning"] = 1] = "Warning";
        SourceControlInputBoxValidationType[SourceControlInputBoxValidationType["Information"] = 2] = "Information";
    })(SourceControlInputBoxValidationType = vscMockExtHostedTypes.SourceControlInputBoxValidationType || (vscMockExtHostedTypes.SourceControlInputBoxValidationType = {}));
    let TaskRevealKind;
    (function (TaskRevealKind) {
        TaskRevealKind[TaskRevealKind["Always"] = 1] = "Always";
        TaskRevealKind[TaskRevealKind["Silent"] = 2] = "Silent";
        TaskRevealKind[TaskRevealKind["Never"] = 3] = "Never";
    })(TaskRevealKind = vscMockExtHostedTypes.TaskRevealKind || (vscMockExtHostedTypes.TaskRevealKind = {}));
    let TaskPanelKind;
    (function (TaskPanelKind) {
        TaskPanelKind[TaskPanelKind["Shared"] = 1] = "Shared";
        TaskPanelKind[TaskPanelKind["Dedicated"] = 2] = "Dedicated";
        TaskPanelKind[TaskPanelKind["New"] = 3] = "New";
    })(TaskPanelKind = vscMockExtHostedTypes.TaskPanelKind || (vscMockExtHostedTypes.TaskPanelKind = {}));
    class TaskGroup {
        constructor(id, _label) {
            if (typeof id !== 'string') {
                throw illegalArgument('name');
            }
            if (typeof _label !== 'string') {
                throw illegalArgument('name');
            }
            this._id = id;
        }
        static from(value) {
            switch (value) {
                case 'clean':
                    return TaskGroup.Clean;
                case 'build':
                    return TaskGroup.Build;
                case 'rebuild':
                    return TaskGroup.Rebuild;
                case 'test':
                    return TaskGroup.Test;
                default:
                    return undefined;
            }
        }
        get id() {
            return this._id;
        }
    }
    TaskGroup.Clean = new TaskGroup('clean', 'Clean');
    TaskGroup.Build = new TaskGroup('build', 'Build');
    TaskGroup.Rebuild = new TaskGroup('rebuild', 'Rebuild');
    TaskGroup.Test = new TaskGroup('test', 'Test');
    vscMockExtHostedTypes.TaskGroup = TaskGroup;
    class ProcessExecution {
        constructor(process, varg1, varg2) {
            if (typeof process !== 'string') {
                throw illegalArgument('process');
            }
            this._process = process;
            if (varg1 !== void 0) {
                if (Array.isArray(varg1)) {
                    this._args = varg1;
                    this._options = varg2;
                }
                else {
                    this._options = varg1;
                }
            }
            if (this._args === void 0) {
                this._args = [];
            }
        }
        get process() {
            return this._process;
        }
        set process(value) {
            if (typeof value !== 'string') {
                throw illegalArgument('process');
            }
            this._process = value;
        }
        get args() {
            return this._args;
        }
        set args(value) {
            if (!Array.isArray(value)) {
                value = [];
            }
            this._args = value;
        }
        get options() {
            return this._options;
        }
        set options(value) {
            this._options = value;
        }
        computeId() {
            // const hash = crypto.createHash('md5');
            // hash.update('process');
            // if (this._process !== void 0) {
            //     hash.update(this._process);
            // }
            // if (this._args && this._args.length > 0) {
            //     for (let arg of this._args) {
            //         hash.update(arg);
            //     }
            // }
            // return hash.digest('hex');
            throw new Error('Not supported');
        }
    }
    vscMockExtHostedTypes.ProcessExecution = ProcessExecution;
    class ShellExecution {
        constructor(arg0, arg1, arg2) {
            if (Array.isArray(arg1)) {
                if (!arg0) {
                    throw illegalArgument('command can\'t be undefined or null');
                }
                if (typeof arg0 !== 'string' && typeof arg0.value !== 'string') {
                    throw illegalArgument('command');
                }
                this._command = arg0;
                this._args = arg1;
                this._options = arg2;
            }
            else {
                if (typeof arg0 !== 'string') {
                    throw illegalArgument('commandLine');
                }
                this._commandLine = arg0;
                this._options = arg1;
            }
        }
        get commandLine() {
            return this._commandLine;
        }
        set commandLine(value) {
            if (typeof value !== 'string') {
                throw illegalArgument('commandLine');
            }
            this._commandLine = value;
        }
        get command() {
            return this._command;
        }
        set command(value) {
            if (typeof value !== 'string' && typeof value.value !== 'string') {
                throw illegalArgument('command');
            }
            this._command = value;
        }
        get args() {
            return this._args;
        }
        set args(value) {
            this._args = value || [];
        }
        get options() {
            return this._options;
        }
        set options(value) {
            this._options = value;
        }
        computeId() {
            // const hash = crypto.createHash('md5');
            // hash.update('shell');
            // if (this._commandLine !== void 0) {
            //     hash.update(this._commandLine);
            // }
            // if (this._command !== void 0) {
            //     hash.update(typeof this._command === 'string' ? this._command : this._command.value);
            // }
            // if (this._args && this._args.length > 0) {
            //     for (let arg of this._args) {
            //         hash.update(typeof arg === 'string' ? arg : arg.value);
            //     }
            // }
            // return hash.digest('hex');
            throw new Error('Not spported');
        }
    }
    vscMockExtHostedTypes.ShellExecution = ShellExecution;
    let ShellQuoting;
    (function (ShellQuoting) {
        ShellQuoting[ShellQuoting["Escape"] = 1] = "Escape";
        ShellQuoting[ShellQuoting["Strong"] = 2] = "Strong";
        ShellQuoting[ShellQuoting["Weak"] = 3] = "Weak";
    })(ShellQuoting = vscMockExtHostedTypes.ShellQuoting || (vscMockExtHostedTypes.ShellQuoting = {}));
    let TaskScope;
    (function (TaskScope) {
        TaskScope[TaskScope["Global"] = 1] = "Global";
        TaskScope[TaskScope["Workspace"] = 2] = "Workspace";
    })(TaskScope = vscMockExtHostedTypes.TaskScope || (vscMockExtHostedTypes.TaskScope = {}));
    class Task {
        constructor(definition, arg2, arg3, arg4, arg5, arg6) {
            this.definition = definition;
            let problemMatchers;
            if (typeof arg2 === 'string') {
                this.name = arg2;
                this.source = arg3;
                this.execution = arg4;
                problemMatchers = arg5;
            }
            else if (arg2 === TaskScope.Global || arg2 === TaskScope.Workspace) {
                this.target = arg2;
                this.name = arg3;
                this.source = arg4;
                this.execution = arg5;
                problemMatchers = arg6;
            }
            else {
                this.target = arg2;
                this.name = arg3;
                this.source = arg4;
                this.execution = arg5;
                problemMatchers = arg6;
            }
            if (typeof problemMatchers === 'string') {
                this._problemMatchers = [problemMatchers];
                this._hasDefinedMatchers = true;
            }
            else if (Array.isArray(problemMatchers)) {
                this._problemMatchers = problemMatchers;
                this._hasDefinedMatchers = true;
            }
            else {
                this._problemMatchers = [];
                this._hasDefinedMatchers = false;
            }
            this._isBackground = false;
        }
        get _id() {
            return this.__id;
        }
        set _id(value) {
            this.__id = value;
        }
        clear() {
            if (this.__id === void 0) {
                return;
            }
            this.__id = undefined;
            this._scope = undefined;
            this._definition = undefined;
            if (this._execution instanceof ProcessExecution) {
                this._definition = {
                    type: 'process',
                    id: this._execution.computeId()
                };
            }
            else if (this._execution instanceof ShellExecution) {
                this._definition = {
                    type: 'shell',
                    id: this._execution.computeId()
                };
            }
        }
        get definition() {
            return this._definition;
        }
        set definition(value) {
            if (value === void 0 || value === null) {
                throw illegalArgument('Kind can\'t be undefined or null');
            }
            this.clear();
            this._definition = value;
        }
        get scope() {
            return this._scope;
        }
        set target(value) {
            this.clear();
            this._scope = value;
        }
        get name() {
            return this._name;
        }
        set name(value) {
            if (typeof value !== 'string') {
                throw illegalArgument('name');
            }
            this.clear();
            this._name = value;
        }
        get execution() {
            return this._execution;
        }
        set execution(value) {
            if (value === null) {
                value = undefined;
            }
            this.clear();
            this._execution = value;
        }
        get problemMatchers() {
            return this._problemMatchers;
        }
        set problemMatchers(value) {
            if (!Array.isArray(value)) {
                this._problemMatchers = [];
                this._hasDefinedMatchers = false;
                return;
            }
            this.clear();
            this._problemMatchers = value;
            this._hasDefinedMatchers = true;
        }
        get hasDefinedMatchers() {
            return this._hasDefinedMatchers;
        }
        get isBackground() {
            return this._isBackground;
        }
        set isBackground(value) {
            if (value !== true && value !== false) {
                value = false;
            }
            this.clear();
            this._isBackground = value;
        }
        get source() {
            return this._source;
        }
        set source(value) {
            if (typeof value !== 'string' || value.length === 0) {
                throw illegalArgument('source must be a string of length > 0');
            }
            this.clear();
            this._source = value;
        }
        get group() {
            return this._group;
        }
        set group(value) {
            if (value === void 0 || value === null) {
                this._group = undefined;
                return;
            }
            this.clear();
            this._group = value;
        }
        get presentationOptions() {
            return this._presentationOptions;
        }
        set presentationOptions(value) {
            if (value === null) {
                value = undefined;
            }
            this.clear();
            this._presentationOptions = value;
        }
    }
    vscMockExtHostedTypes.Task = Task;
    let ProgressLocation;
    (function (ProgressLocation) {
        ProgressLocation[ProgressLocation["SourceControl"] = 1] = "SourceControl";
        ProgressLocation[ProgressLocation["Window"] = 10] = "Window";
        ProgressLocation[ProgressLocation["Notification"] = 15] = "Notification";
    })(ProgressLocation = vscMockExtHostedTypes.ProgressLocation || (vscMockExtHostedTypes.ProgressLocation = {}));
    class TreeItem {
        constructor(arg1, collapsibleState = TreeItemCollapsibleState.None) {
            this.collapsibleState = collapsibleState;
            if (arg1 instanceof uri_1.vscUri.URI) {
                this.resourceUri = arg1;
            }
            else {
                this.label = arg1;
            }
        }
    }
    vscMockExtHostedTypes.TreeItem = TreeItem;
    let TreeItemCollapsibleState;
    (function (TreeItemCollapsibleState) {
        TreeItemCollapsibleState[TreeItemCollapsibleState["None"] = 0] = "None";
        TreeItemCollapsibleState[TreeItemCollapsibleState["Collapsed"] = 1] = "Collapsed";
        TreeItemCollapsibleState[TreeItemCollapsibleState["Expanded"] = 2] = "Expanded";
    })(TreeItemCollapsibleState = vscMockExtHostedTypes.TreeItemCollapsibleState || (vscMockExtHostedTypes.TreeItemCollapsibleState = {}));
    class ThemeIcon {
        constructor(id) {
            this.id = id;
        }
    }
    ThemeIcon.File = new ThemeIcon('file');
    ThemeIcon.Folder = new ThemeIcon('folder');
    vscMockExtHostedTypes.ThemeIcon = ThemeIcon;
    class ThemeColor {
        constructor(id) {
            this.id = id;
        }
    }
    vscMockExtHostedTypes.ThemeColor = ThemeColor;
    let ConfigurationTarget;
    (function (ConfigurationTarget) {
        ConfigurationTarget[ConfigurationTarget["Global"] = 1] = "Global";
        ConfigurationTarget[ConfigurationTarget["Workspace"] = 2] = "Workspace";
        ConfigurationTarget[ConfigurationTarget["WorkspaceFolder"] = 3] = "WorkspaceFolder";
    })(ConfigurationTarget = vscMockExtHostedTypes.ConfigurationTarget || (vscMockExtHostedTypes.ConfigurationTarget = {}));
    class RelativePattern {
        constructor(base, pattern) {
            if (typeof base !== 'string') {
                if (!base || !uri_1.vscUri.URI.isUri(base.uri)) {
                    throw illegalArgument('base');
                }
            }
            if (typeof pattern !== 'string') {
                throw illegalArgument('pattern');
            }
            this.base = typeof base === 'string' ? base : base.uri.fsPath;
            this.pattern = pattern;
        }
        pathToRelative(from, to) {
            return path_1.relative(from, to);
        }
    }
    vscMockExtHostedTypes.RelativePattern = RelativePattern;
    class Breakpoint {
        constructor(enabled, condition, hitCondition, logMessage) {
            this.enabled = typeof enabled === 'boolean' ? enabled : true;
            if (typeof condition === 'string') {
                this.condition = condition;
            }
            if (typeof hitCondition === 'string') {
                this.hitCondition = hitCondition;
            }
            if (typeof logMessage === 'string') {
                this.logMessage = logMessage;
            }
        }
    }
    vscMockExtHostedTypes.Breakpoint = Breakpoint;
    class SourceBreakpoint extends Breakpoint {
        constructor(location, enabled, condition, hitCondition, logMessage) {
            super(enabled, condition, hitCondition, logMessage);
            if (location === null) {
                throw illegalArgument('location');
            }
            this.location = location;
        }
    }
    vscMockExtHostedTypes.SourceBreakpoint = SourceBreakpoint;
    class FunctionBreakpoint extends Breakpoint {
        constructor(functionName, enabled, condition, hitCondition, logMessage) {
            super(enabled, condition, hitCondition, logMessage);
            if (!functionName) {
                throw illegalArgument('functionName');
            }
            this.functionName = functionName;
        }
    }
    vscMockExtHostedTypes.FunctionBreakpoint = FunctionBreakpoint;
    class DebugAdapterExecutable {
        constructor(command, args) {
            this.command = command;
            this.args = args;
        }
    }
    vscMockExtHostedTypes.DebugAdapterExecutable = DebugAdapterExecutable;
    let LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["Trace"] = 1] = "Trace";
        LogLevel[LogLevel["Debug"] = 2] = "Debug";
        LogLevel[LogLevel["Info"] = 3] = "Info";
        LogLevel[LogLevel["Warning"] = 4] = "Warning";
        LogLevel[LogLevel["Error"] = 5] = "Error";
        LogLevel[LogLevel["Critical"] = 6] = "Critical";
        LogLevel[LogLevel["Off"] = 7] = "Off";
    })(LogLevel = vscMockExtHostedTypes.LogLevel || (vscMockExtHostedTypes.LogLevel = {}));
    //#region file api
    let FileChangeType;
    (function (FileChangeType) {
        FileChangeType[FileChangeType["Changed"] = 1] = "Changed";
        FileChangeType[FileChangeType["Created"] = 2] = "Created";
        FileChangeType[FileChangeType["Deleted"] = 3] = "Deleted";
    })(FileChangeType = vscMockExtHostedTypes.FileChangeType || (vscMockExtHostedTypes.FileChangeType = {}));
    class FileSystemError extends Error {
        constructor(uriOrMessage, code, terminator) {
            super(uri_1.vscUri.URI.isUri(uriOrMessage) ? uriOrMessage.toString(true) : uriOrMessage);
            this.name = code ? `${code} (FileSystemError)` : `FileSystemError`;
            // workaround when extending builtin objects and when compiling to ES5, see:
            // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
            if (typeof Object.setPrototypeOf === 'function') {
                Object.setPrototypeOf(this, FileSystemError.prototype);
            }
            if (typeof Error.captureStackTrace === 'function' && typeof terminator === 'function') {
                // nice stack traces
                Error.captureStackTrace(this, terminator);
            }
        }
        static FileExists(messageOrUri) {
            return new FileSystemError(messageOrUri, 'EntryExists', FileSystemError.FileExists);
        }
        static FileNotFound(messageOrUri) {
            return new FileSystemError(messageOrUri, 'EntryNotFound', FileSystemError.FileNotFound);
        }
        static FileNotADirectory(messageOrUri) {
            return new FileSystemError(messageOrUri, 'EntryNotADirectory', FileSystemError.FileNotADirectory);
        }
        static FileIsADirectory(messageOrUri) {
            return new FileSystemError(messageOrUri, 'EntryIsADirectory', FileSystemError.FileIsADirectory);
        }
        static NoPermissions(messageOrUri) {
            return new FileSystemError(messageOrUri, 'NoPermissions', FileSystemError.NoPermissions);
        }
        static Unavailable(messageOrUri) {
            return new FileSystemError(messageOrUri, 'Unavailable', FileSystemError.Unavailable);
        }
    }
    vscMockExtHostedTypes.FileSystemError = FileSystemError;
    //#endregion
    //#region folding api
    class FoldingRange {
        constructor(start, end, kind) {
            this.start = start;
            this.end = end;
            this.kind = kind;
        }
    }
    vscMockExtHostedTypes.FoldingRange = FoldingRange;
    let FoldingRangeKind;
    (function (FoldingRangeKind) {
        FoldingRangeKind[FoldingRangeKind["Comment"] = 1] = "Comment";
        FoldingRangeKind[FoldingRangeKind["Imports"] = 2] = "Imports";
        FoldingRangeKind[FoldingRangeKind["Region"] = 3] = "Region";
    })(FoldingRangeKind = vscMockExtHostedTypes.FoldingRangeKind || (vscMockExtHostedTypes.FoldingRangeKind = {}));
    //#endregion
    let CommentThreadCollapsibleState;
    (function (CommentThreadCollapsibleState) {
        /**
         * Determines an item is collapsed
         */
        CommentThreadCollapsibleState[CommentThreadCollapsibleState["Collapsed"] = 0] = "Collapsed";
        /**
         * Determines an item is expanded
         */
        CommentThreadCollapsibleState[CommentThreadCollapsibleState["Expanded"] = 1] = "Expanded";
    })(CommentThreadCollapsibleState = vscMockExtHostedTypes.CommentThreadCollapsibleState || (vscMockExtHostedTypes.CommentThreadCollapsibleState = {}));
})(vscMockExtHostedTypes = exports.vscMockExtHostedTypes || (exports.vscMockExtHostedTypes = {}));
//# sourceMappingURL=extHostedTypes.js.map