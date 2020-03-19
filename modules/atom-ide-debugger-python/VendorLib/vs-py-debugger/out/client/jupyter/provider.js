"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
class JupyterProvider {
    /**
     * Returns a Regular Expression used to determine whether a line is a Cell delimiter or not
     *
     * @type {RegExp}
     * @memberOf LanguageProvider
     */
    get cellIdentifier() {
        return /^(# %%|#%%|# \<codecell\>|# In\[\d*?\]|# In\[ \])(.*)/i;
    }
    /**
     * Returns the selected code
     * If not implemented, then the currently active line or selected code is taken.
     * Can be implemented to ensure valid blocks of code are selected.
     * E.g if user selects only the If statement, code can be impelemented to ensure all code within the if statement (block) is returned
     * @param {string} selectedCode The selected code as identified by this extension.
     * @param {Range} [currentCell] Range of the currently active cell
     * @returns {Promise<string>} The code selected. If nothing is to be done, return the parameter value.
     *
     * @memberOf LanguageProvider
     */
    getSelectedCode(selectedCode, currentCell) {
        if (!JupyterProvider.isCodeBlock(selectedCode)) {
            return Promise.resolve(selectedCode);
        }
        // ok we're in a block, look for the end of the block untill the last line in the cell (if there are any cells)
        return new Promise((resolve, reject) => {
            const activeEditor = vscode_1.window.activeTextEditor;
            const endLineNumber = currentCell ? currentCell.end.line : activeEditor.document.lineCount - 1;
            const startIndent = selectedCode.indexOf(selectedCode.trim());
            const nextStartLine = activeEditor.selection.start.line + 1;
            for (let lineNumber = nextStartLine; lineNumber <= endLineNumber; lineNumber++) {
                const line = activeEditor.document.lineAt(lineNumber);
                const nextLine = line.text;
                const nextLineIndent = nextLine.indexOf(nextLine.trim());
                if (nextLine.trim().indexOf('#') === 0) {
                    continue;
                }
                if (nextLineIndent === startIndent) {
                    // Return code untill previous line
                    const endRange = activeEditor.document.lineAt(lineNumber - 1).range.end;
                    resolve(activeEditor.document.getText(new vscode_1.Range(activeEditor.selection.start, endRange)));
                }
            }
            resolve(activeEditor.document.getText(currentCell));
        });
    }
    /**
     * Gets the first line (position) of executable code within a range
     *
     * @param {TextDocument} document
     * @param {number} startLine
     * @param {number} endLine
     * @returns {Promise<Position>}
     *
     * @memberOf LanguageProvider
     */
    getFirstLineOfExecutableCode(document, range) {
        for (let lineNumber = range.start.line; lineNumber < range.end.line; lineNumber++) {
            let line = document.lineAt(lineNumber);
            if (line.isEmptyOrWhitespace) {
                continue;
            }
            const lineText = line.text;
            const trimmedLine = lineText.trim();
            if (trimmedLine.startsWith('#')) {
                continue;
            }
            // Yay we have a line
            // Remember, we need to set the cursor to a character other than white space
            // Highlighting doesn't kick in for comments or white space
            return Promise.resolve(new vscode_1.Position(lineNumber, lineText.indexOf(trimmedLine)));
        }
        // give up
        return Promise.resolve(new vscode_1.Position(range.start.line, 0));
    }
    static isCodeBlock(code) {
        return code.trim().endsWith(':') && code.indexOf('#') === -1;
    }
}
exports.JupyterProvider = JupyterProvider;
//# sourceMappingURL=provider.js.map