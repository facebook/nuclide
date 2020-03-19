"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const constants_1 = require("../../common/constants");
const testFiles_1 = require("./testFiles");
function activateCodeLenses(onDidChange, symboldProvider, testCollectionStorage) {
    const disposables = [];
    const codeLensProvider = new testFiles_1.TestFileCodeLensProvider(onDidChange, symboldProvider, testCollectionStorage);
    disposables.push(vscode.languages.registerCodeLensProvider(constants_1.PYTHON, codeLensProvider));
    return {
        dispose: () => { disposables.forEach(d => d.dispose()); }
    };
}
exports.activateCodeLenses = activateCodeLenses;
//# sourceMappingURL=main.js.map