"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const vscode_2 = require("vscode");
class CodeBlockFormatProvider {
    constructor(blockRegExp, previousBlockRegExps, boundaryRegExps) {
        this.blockRegExp = blockRegExp;
        this.previousBlockRegExps = previousBlockRegExps;
        this.boundaryRegExps = boundaryRegExps;
    }
    canProvideEdits(line) {
        return this.blockRegExp.test(line);
    }
    provideEdits(document, position, ch, options, line) {
        // We can have else for the following blocks:
        // if:
        // elif x:
        // for x in y:
        // while x:
        // We need to find a block statement that is less than or equal to this statement block (but not greater)
        for (let lineNumber = position.line - 1; lineNumber >= 0; lineNumber -= 1) {
            const prevLine = document.lineAt(lineNumber);
            const prevLineText = prevLine.text;
            // Oops, we've reached a boundary (like the function or class definition)
            // Get out of here
            if (this.boundaryRegExps.some(value => value.test(prevLineText))) {
                return [];
            }
            const blockRegEx = this.previousBlockRegExps.find(value => value.test(prevLineText));
            if (!blockRegEx) {
                continue;
            }
            const startOfBlockInLine = prevLine.firstNonWhitespaceCharacterIndex;
            if (startOfBlockInLine > line.firstNonWhitespaceCharacterIndex) {
                continue;
            }
            const startPosition = new vscode_2.Position(position.line, 0);
            const endPosition = new vscode_2.Position(position.line, line.firstNonWhitespaceCharacterIndex - startOfBlockInLine);
            if (startPosition.isEqual(endPosition)) {
                // current block cannot be at the same level as a preivous block
                continue;
            }
            if (options.insertSpaces) {
                return [
                    vscode_1.TextEdit.delete(new vscode_2.Range(startPosition, endPosition))
                ];
            }
            else {
                // Delete everything before the block and insert the same characters we have in the previous block
                const prefixOfPreviousBlock = prevLineText.substring(0, startOfBlockInLine);
                const startDeletePosition = new vscode_2.Position(position.line, 0);
                const endDeletePosition = new vscode_2.Position(position.line, line.firstNonWhitespaceCharacterIndex);
                return [
                    vscode_1.TextEdit.delete(new vscode_2.Range(startDeletePosition, endDeletePosition)),
                    vscode_1.TextEdit.insert(startDeletePosition, prefixOfPreviousBlock)
                ];
            }
        }
        return [];
    }
}
exports.CodeBlockFormatProvider = CodeBlockFormatProvider;
//# sourceMappingURL=codeBlockFormatProvider.js.map