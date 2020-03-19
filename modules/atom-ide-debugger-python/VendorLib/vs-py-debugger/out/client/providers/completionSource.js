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
const vscode = require("vscode");
const types_1 = require("../common/types");
const proxy = require("./jediProxy");
const providerUtilities_1 = require("./providerUtilities");
class DocumentPosition {
    constructor(document, position) {
        this.document = document;
        this.position = position;
    }
    static fromObject(item) {
        // tslint:disable-next-line:no-any
        return item._documentPosition;
    }
    attachTo(item) {
        // tslint:disable-next-line:no-any
        item._documentPosition = this;
    }
}
class CompletionSource {
    constructor(jediFactory, serviceContainer, itemInfoSource) {
        this.serviceContainer = serviceContainer;
        this.itemInfoSource = itemInfoSource;
        this.jediFactory = jediFactory;
    }
    getVsCodeCompletionItems(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.getCompletionResult(document, position, token);
            if (result === undefined) {
                return Promise.resolve([]);
            }
            return this.toVsCodeCompletions(new DocumentPosition(document, position), result, document.uri);
        });
    }
    getDocumentation(completionItem, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const documentPosition = DocumentPosition.fromObject(completionItem);
            if (documentPosition === undefined) {
                return;
            }
            // Supply hover source with simulated document text where item in question was 'already typed'.
            const document = documentPosition.document;
            const position = documentPosition.position;
            const wordRange = document.getWordRangeAtPosition(position);
            const leadingRange = wordRange !== undefined
                ? new vscode.Range(new vscode.Position(0, 0), wordRange.start)
                : new vscode.Range(new vscode.Position(0, 0), position);
            const itemString = completionItem.label;
            const sourceText = `${document.getText(leadingRange)}${itemString}`;
            const range = new vscode.Range(leadingRange.end, leadingRange.end.translate(0, itemString.length));
            return this.itemInfoSource.getItemInfoFromText(document.uri, document.fileName, range, sourceText, token);
        });
    }
    getCompletionResult(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (position.character <= 0 ||
                providerUtilities_1.isPositionInsideStringOrComment(document, position)) {
                return undefined;
            }
            const type = proxy.CommandType.Completions;
            const columnIndex = position.character;
            const source = document.getText();
            const cmd = {
                command: type,
                fileName: document.fileName,
                columnIndex: columnIndex,
                lineIndex: position.line,
                source: source
            };
            return this.jediFactory.getJediProxyHandler(document.uri).sendCommand(cmd, token);
        });
    }
    toVsCodeCompletions(documentPosition, data, resource) {
        return data && data.items.length > 0 ? data.items.map(item => this.toVsCodeCompletion(documentPosition, item, resource)) : [];
    }
    toVsCodeCompletion(documentPosition, item, resource) {
        const completionItem = new vscode.CompletionItem(item.text);
        completionItem.kind = item.type;
        const configurationService = this.serviceContainer.get(types_1.IConfigurationService);
        const pythonSettings = configurationService.getSettings(resource);
        if (pythonSettings.autoComplete.addBrackets === true &&
            (item.kind === vscode.SymbolKind.Function || item.kind === vscode.SymbolKind.Method)) {
            completionItem.insertText = new vscode.SnippetString(item.text).appendText('(').appendTabstop().appendText(')');
        }
        // Ensure the built in members are at the bottom.
        completionItem.sortText = (completionItem.label.startsWith('__') ? 'z' : (completionItem.label.startsWith('_') ? 'y' : '__')) + completionItem.label;
        documentPosition.attachTo(completionItem);
        return completionItem;
    }
}
exports.CompletionSource = CompletionSource;
//# sourceMappingURL=completionSource.js.map