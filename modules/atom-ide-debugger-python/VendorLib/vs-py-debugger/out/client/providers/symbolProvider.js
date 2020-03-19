'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const types_1 = require("../common/platform/types");
const async_1 = require("../common/utils/async");
const telemetry_1 = require("../telemetry");
const constants_1 = require("../telemetry/constants");
const proxy = require("./jediProxy");
function flattenSymbolTree(tree, uri, containerName = '') {
    const flattened = [];
    const range = new vscode_1.Range(tree.range.start.line, tree.range.start.character, tree.range.end.line, tree.range.end.character);
    // For whatever reason, the values of VS Code's SymbolKind enum
    // are off-by-one relative to the LSP:
    //  https://microsoft.github.io/language-server-protocol/specification#document-symbols-request-leftwards_arrow_with_hook
    const kind = tree.kind - 1;
    const info = new vscode_1.SymbolInformation(tree.name, 
    // Type coercion is a bit fuzzy when it comes to enums, so we
    // play it safe by explicitly converting.
    vscode_1.SymbolKind[vscode_1.SymbolKind[kind]], containerName, new vscode_1.Location(uri, range));
    flattened.push(info);
    if (tree.children && tree.children.length > 0) {
        // FYI: Jedi doesn't fully-qualify the container name so we
        // don't bother here either.
        //const fullName = `${containerName}.${tree.name}`;
        for (const child of tree.children) {
            const flattenedChild = flattenSymbolTree(child, uri, tree.name);
            flattened.push(...flattenedChild);
        }
    }
    return flattened;
}
/**
 * Provides Python symbols to VS Code (from the language server).
 *
 * See:
 *   https://code.visualstudio.com/docs/extensionAPI/vscode-api#DocumentSymbolProvider
 */
class LanguageServerSymbolProvider {
    constructor(languageClient) {
        this.languageClient = languageClient;
    }
    provideDocumentSymbols(document, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = document.uri;
            const args = { textDocument: { uri: uri.toString() } };
            const raw = yield this.languageClient.sendRequest('textDocument/documentSymbol', args, token);
            const symbols = [];
            for (const tree of raw) {
                const flattened = flattenSymbolTree(tree, uri);
                symbols.push(...flattened);
            }
            return Promise.resolve(symbols);
        });
    }
}
exports.LanguageServerSymbolProvider = LanguageServerSymbolProvider;
/**
 * Provides Python symbols to VS Code (from Jedi).
 *
 * See:
 *   https://code.visualstudio.com/docs/extensionAPI/vscode-api#DocumentSymbolProvider
 */
class JediSymbolProvider {
    constructor(serviceContainer, jediFactory, debounceTimeoutMs = 500) {
        this.jediFactory = jediFactory;
        this.debounceTimeoutMs = debounceTimeoutMs;
        this.debounceRequest = new Map();
        this.fs = serviceContainer.get(types_1.IFileSystem);
    }
    provideDocumentSymbols(document, token) {
        return this.provideDocumentSymbolsThrottled(document, token);
    }
    provideDocumentSymbolsThrottled(document, token) {
        const key = `${document.uri.fsPath}`;
        if (this.debounceRequest.has(key)) {
            const item = this.debounceRequest.get(key);
            clearTimeout(item.timer);
            item.deferred.resolve([]);
        }
        const deferred = async_1.createDeferred();
        const timer = setTimeout(() => {
            if (token.isCancellationRequested) {
                return deferred.resolve([]);
            }
            const filename = document.fileName;
            const cmd = {
                command: proxy.CommandType.Symbols,
                fileName: filename,
                columnIndex: 0,
                lineIndex: 0
            };
            if (document.isDirty) {
                cmd.source = document.getText();
            }
            this.jediFactory.getJediProxyHandler(document.uri).sendCommand(cmd, token)
                .then(data => this.parseData(document, data))
                .then(items => deferred.resolve(items))
                .catch(ex => deferred.reject(ex));
        }, this.debounceTimeoutMs);
        token.onCancellationRequested(() => {
            clearTimeout(timer);
            deferred.resolve([]);
            this.debounceRequest.delete(key);
        });
        // When a document is not saved on FS, we cannot uniquely identify it, so lets not debounce, but delay the symbol provider.
        if (!document.isUntitled) {
            this.debounceRequest.set(key, { timer, deferred });
        }
        return deferred.promise;
    }
    // This does not appear to be used anywhere currently...
    // tslint:disable-next-line:no-unused-variable
    provideDocumentSymbolsUnthrottled(document, token) {
        const filename = document.fileName;
        const cmd = {
            command: proxy.CommandType.Symbols,
            fileName: filename,
            columnIndex: 0,
            lineIndex: 0
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }
        return this.jediFactory.getJediProxyHandler(document.uri).sendCommandNonCancellableCommand(cmd, token)
            .then(data => this.parseData(document, data));
    }
    parseData(document, data) {
        if (data) {
            const symbols = data.definitions.filter(sym => this.fs.arePathsSame(sym.fileName, document.fileName));
            return symbols.map(sym => {
                const symbol = sym.kind;
                const range = new vscode_1.Range(sym.range.startLine, sym.range.startColumn, sym.range.endLine, sym.range.endColumn);
                const uri = vscode_1.Uri.file(sym.fileName);
                const location = new vscode_1.Location(uri, range);
                return new vscode_1.SymbolInformation(sym.text, symbol, sym.container, location);
            });
        }
        return [];
    }
}
__decorate([
    telemetry_1.captureTelemetry(constants_1.SYMBOL)
], JediSymbolProvider.prototype, "provideDocumentSymbols", null);
exports.JediSymbolProvider = JediSymbolProvider;
//# sourceMappingURL=symbolProvider.js.map