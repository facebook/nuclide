// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const vscode = require("vscode");
const restTextConverter_1 = require("../common/markdown/restTextConverter");
const proxy = require("./jediProxy");
class LanguageItemInfo {
    constructor(tooltip, detail, signature) {
        this.tooltip = tooltip;
        this.detail = detail;
        this.signature = signature;
    }
}
exports.LanguageItemInfo = LanguageItemInfo;
class ItemInfoSource {
    constructor(jediFactory) {
        this.jediFactory = jediFactory;
        this.textConverter = new restTextConverter_1.RestTextConverter();
    }
    getItemInfoFromText(documentUri, fileName, range, sourceText, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.getHoverResultFromTextRange(documentUri, fileName, range, sourceText, token);
            if (!result || !result.items.length) {
                return;
            }
            return this.getItemInfoFromHoverResult(result, '');
        });
    }
    getItemInfoFromDocument(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const range = document.getWordRangeAtPosition(position);
            if (!range || range.isEmpty) {
                return;
            }
            const result = yield this.getHoverResultFromDocument(document, position, token);
            if (!result || !result.items.length) {
                return;
            }
            const word = document.getText(range);
            return this.getItemInfoFromHoverResult(result, word);
        });
    }
    getHoverResultFromDocument(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (position.character <= 0 || document.lineAt(position.line).text.match(/^\s*\/\//)) {
                return;
            }
            const range = document.getWordRangeAtPosition(position);
            if (!range || range.isEmpty) {
                return;
            }
            return this.getHoverResultFromDocumentRange(document, range, token);
        });
    }
    getHoverResultFromDocumentRange(document, range, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const cmd = {
                command: proxy.CommandType.Hover,
                fileName: document.fileName,
                columnIndex: range.end.character,
                lineIndex: range.end.line
            };
            if (document.isDirty) {
                cmd.source = document.getText();
            }
            return this.jediFactory.getJediProxyHandler(document.uri).sendCommand(cmd, token);
        });
    }
    getHoverResultFromTextRange(documentUri, fileName, range, sourceText, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const cmd = {
                command: proxy.CommandType.Hover,
                fileName: fileName,
                columnIndex: range.end.character,
                lineIndex: range.end.line,
                source: sourceText
            };
            return this.jediFactory.getJediProxyHandler(documentUri).sendCommand(cmd, token);
        });
    }
    getItemInfoFromHoverResult(data, currentWord) {
        const infos = [];
        data.items.forEach(item => {
            const signature = this.getSignature(item, currentWord);
            let tooltip = new vscode.MarkdownString();
            if (item.docstring) {
                let lines = item.docstring.split(/\r?\n/);
                // If the docstring starts with the signature, then remove those lines from the docstring.
                if (lines.length > 0 && item.signature.indexOf(lines[0]) === 0) {
                    lines.shift();
                    const endIndex = lines.findIndex(line => item.signature.endsWith(line));
                    if (endIndex >= 0) {
                        lines = lines.filter((line, index) => index > endIndex);
                    }
                }
                if (lines.length > 0 && currentWord.length > 0 && item.signature.startsWith(currentWord) && lines[0].startsWith(currentWord) && lines[0].endsWith(')')) {
                    lines.shift();
                }
                if (signature.length > 0) {
                    tooltip = tooltip.appendMarkdown(['```python', signature, '```', ''].join(os_1.EOL));
                }
                const description = this.textConverter.toMarkdown(lines.join(os_1.EOL));
                tooltip = tooltip.appendMarkdown(description);
                infos.push(new LanguageItemInfo(tooltip, item.description, new vscode.MarkdownString(signature)));
                return;
            }
            if (item.description) {
                if (signature.length > 0) {
                    tooltip.appendMarkdown(['```python', signature, '```', ''].join(os_1.EOL));
                }
                const description = this.textConverter.toMarkdown(item.description);
                tooltip.appendMarkdown(description);
                infos.push(new LanguageItemInfo(tooltip, item.description, new vscode.MarkdownString(signature)));
                return;
            }
            if (item.text) { // Most probably variable type
                const code = currentWord && currentWord.length > 0
                    ? `${currentWord}: ${item.text}`
                    : item.text;
                tooltip.appendMarkdown(['```python', code, '```', ''].join(os_1.EOL));
                infos.push(new LanguageItemInfo(tooltip, '', new vscode.MarkdownString()));
            }
        });
        return infos;
    }
    getSignature(item, currentWord) {
        let { signature } = item;
        switch (item.kind) {
            case vscode.SymbolKind.Constructor:
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Method: {
                signature = `def ${signature}`;
                break;
            }
            case vscode.SymbolKind.Class: {
                signature = `class ${signature}`;
                break;
            }
            case vscode.SymbolKind.Module: {
                if (signature.length > 0) {
                    signature = `module ${signature}`;
                }
                break;
            }
            default: {
                signature = typeof item.text === 'string' && item.text.length > 0 ? item.text : currentWord;
            }
        }
        return signature;
    }
}
exports.ItemInfoSource = ItemInfoSource;
//# sourceMappingURL=itemInfoSource.js.map