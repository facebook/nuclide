// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
class TextIterator {
    constructor(text) {
        this.text = text;
    }
    charCodeAt(index) {
        if (index >= 0 && index < this.text.length) {
            return this.text.charCodeAt(index);
        }
        return 0;
    }
    get length() {
        return this.text.length;
    }
    getText() {
        return this.text;
    }
}
exports.TextIterator = TextIterator;
class DocumentTextIterator {
    constructor(document) {
        this.document = document;
        const lastIndex = this.document.lineCount - 1;
        const lastLine = this.document.lineAt(lastIndex);
        const end = new vscode_1.Position(lastIndex, lastLine.range.end.character);
        this.length = this.document.offsetAt(end);
    }
    charCodeAt(index) {
        const position = this.document.positionAt(index);
        return this.document
            .getText(new vscode_1.Range(position, position.translate(0, 1)))
            .charCodeAt(position.character);
    }
    getText() {
        return this.document.getText();
    }
}
exports.DocumentTextIterator = DocumentTextIterator;
//# sourceMappingURL=textIterator.js.map