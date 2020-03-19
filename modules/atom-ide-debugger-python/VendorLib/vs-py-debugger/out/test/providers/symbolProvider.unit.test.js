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
// tslint:disable:max-func-body-length no-any no-require-imports no-var-requires
const chai_1 = require("chai");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/platform/types");
const string_1 = require("../../client/common/utils/string");
const text_1 = require("../../client/common/utils/text");
const jediProxyFactory_1 = require("../../client/languageServices/jediProxyFactory");
const symbolProvider_1 = require("../../client/providers/symbolProvider");
const assertArrays = require('chai-arrays');
chai_1.use(assertArrays);
suite('Jedi Symbol Provider', () => {
    let serviceContainer;
    let jediHandler;
    let jediFactory;
    let fileSystem;
    let provider;
    let uri;
    let doc;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        jediFactory = TypeMoq.Mock.ofType(jediProxyFactory_1.JediFactory);
        jediHandler = TypeMoq.Mock.ofType();
        fileSystem = TypeMoq.Mock.ofType();
        doc = TypeMoq.Mock.ofType();
        jediFactory.setup(j => j.getJediProxyHandler(TypeMoq.It.isAny()))
            .returns(() => jediHandler.object);
        serviceContainer.setup(c => c.get(types_1.IFileSystem)).returns(() => fileSystem.object);
    });
    function testDocumentation(requestId, fileName, expectedSize, token, isUntitled = false) {
        return __awaiter(this, void 0, void 0, function* () {
            fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => true);
            token = token ? token : new vscode_1.CancellationTokenSource().token;
            const symbolResult = TypeMoq.Mock.ofType();
            const definitions = [
                {
                    container: '', fileName: fileName, kind: vscode_1.SymbolKind.Array,
                    range: { endColumn: 0, endLine: 0, startColumn: 0, startLine: 0 },
                    rawType: '', text: '', type: vscode_1.CompletionItemKind.Class
                }
            ];
            uri = vscode_1.Uri.file(fileName);
            doc.setup(d => d.uri).returns(() => uri);
            doc.setup(d => d.fileName).returns(() => fileName);
            doc.setup(d => d.isUntitled).returns(() => isUntitled);
            doc.setup(d => d.getText(TypeMoq.It.isAny())).returns(() => '');
            symbolResult.setup(c => c.requestId).returns(() => requestId);
            symbolResult.setup(c => c.definitions).returns(() => definitions);
            symbolResult.setup((c) => c.then).returns(() => undefined);
            jediHandler.setup(j => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(symbolResult.object));
            const items = yield provider.provideDocumentSymbols(doc.object, token);
            chai_1.expect(items).to.be.array();
            chai_1.expect(items).to.be.ofSize(expectedSize);
        });
    }
    test('Ensure symbols are returned', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        yield testDocumentation(1, __filename, 1);
    }));
    test('Ensure symbols are returned (for untitled documents)', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        yield testDocumentation(1, __filename, 1, undefined, true);
    }));
    test('Ensure symbols are returned with a debounce of 100ms', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        yield testDocumentation(1, __filename, 1);
    }));
    test('Ensure symbols are returned with a debounce of 100ms (for untitled documents)', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        yield testDocumentation(1, __filename, 1, undefined, true);
    }));
    test('Ensure symbols are not returned when cancelled', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        const tokenSource = new vscode_1.CancellationTokenSource();
        tokenSource.cancel();
        yield testDocumentation(1, __filename, 0, tokenSource.token);
    }));
    test('Ensure symbols are not returned when cancelled (for untitled documents)', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        const tokenSource = new vscode_1.CancellationTokenSource();
        tokenSource.cancel();
        yield testDocumentation(1, __filename, 0, tokenSource.token, true);
    }));
    test('Ensure symbols are returned only for the last request', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        yield Promise.all([
            testDocumentation(1, __filename, 0),
            testDocumentation(2, __filename, 0),
            testDocumentation(3, __filename, 1)
        ]);
    }));
    test('Ensure symbols are returned for all the requests when the doc is untitled', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        yield Promise.all([
            testDocumentation(1, __filename, 1, undefined, true),
            testDocumentation(2, __filename, 1, undefined, true),
            testDocumentation(3, __filename, 1, undefined, true)
        ]);
    }));
    test('Ensure symbols are returned for multiple documents', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        yield Promise.all([
            testDocumentation(1, 'file1', 1),
            testDocumentation(2, 'file2', 1)
        ]);
    }));
    test('Ensure symbols are returned for multiple untitled documents ', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        yield Promise.all([
            testDocumentation(1, 'file1', 1, undefined, true),
            testDocumentation(2, 'file2', 1, undefined, true)
        ]);
    }));
    test('Ensure symbols are returned for multiple documents with a debounce of 100ms', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        yield Promise.all([
            testDocumentation(1, 'file1', 1),
            testDocumentation(2, 'file2', 1)
        ]);
    }));
    test('Ensure symbols are returned for multiple untitled documents with a debounce of 100ms', () => __awaiter(this, void 0, void 0, function* () {
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 100);
        yield Promise.all([
            testDocumentation(1, 'file1', 1, undefined, true),
            testDocumentation(2, 'file2', 1, undefined, true)
        ]);
    }));
    test('Ensure IFileSystem.arePathsSame is used', () => __awaiter(this, void 0, void 0, function* () {
        doc.setup(d => d.getText())
            .returns(() => '')
            .verifiable(TypeMoq.Times.once());
        doc.setup(d => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        doc.setup(d => d.fileName)
            .returns(() => __filename);
        const symbols = TypeMoq.Mock.ofType();
        symbols.setup((s) => s.then).returns(() => undefined);
        const definitions = [];
        for (let counter = 0; counter < 3; counter += 1) {
            const def = TypeMoq.Mock.ofType();
            def.setup(d => d.fileName).returns(() => counter.toString());
            definitions.push(def.object);
            fileSystem.setup(fs => fs.arePathsSame(TypeMoq.It.isValue(counter.toString()), TypeMoq.It.isValue(__filename)))
                .returns(() => false)
                .verifiable(TypeMoq.Times.exactly(1));
        }
        symbols.setup(s => s.definitions)
            .returns(() => definitions)
            .verifiable(TypeMoq.Times.atLeastOnce());
        jediHandler.setup(j => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(symbols.object))
            .verifiable(TypeMoq.Times.once());
        provider = new symbolProvider_1.JediSymbolProvider(serviceContainer.object, jediFactory.object, 0);
        yield provider.provideDocumentSymbols(doc.object, new vscode_1.CancellationTokenSource().token);
        doc.verifyAll();
        symbols.verifyAll();
        fileSystem.verifyAll();
        jediHandler.verifyAll();
    }));
});
suite('Language Server Symbol Provider', () => {
    function createLanguageClient(token, results) {
        const langClient = TypeMoq.Mock.ofType(undefined, TypeMoq.MockBehavior.Strict);
        for (const [doc, symbols] of results) {
            langClient.setup(l => l.sendRequest(TypeMoq.It.isValue('textDocument/documentSymbol'), TypeMoq.It.isValue(doc), TypeMoq.It.isValue(token)))
                .returns(() => Promise.resolve(symbols))
                .verifiable(TypeMoq.Times.once());
        }
        return langClient;
    }
    function getRawDoc(uri) {
        return {
            textDocument: {
                uri: uri.toString()
            }
        };
    }
    test('Ensure symbols are returned - simple', () => __awaiter(this, void 0, void 0, function* () {
        const raw = [{
                name: 'spam',
                kind: vscode_1.SymbolKind.Array + 1,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                },
                children: []
            }];
        const uri = vscode_1.Uri.file(__filename);
        const expected = createSymbols(uri, [
            ['spam', vscode_1.SymbolKind.Array, 0]
        ]);
        const doc = createDoc(uri);
        const token = new vscode_1.CancellationTokenSource().token;
        const langClient = createLanguageClient(token, [
            [getRawDoc(uri), raw]
        ]);
        const provider = new symbolProvider_1.LanguageServerSymbolProvider(langClient.object);
        const items = yield provider.provideDocumentSymbols(doc.object, token);
        chai_1.expect(items).to.deep.equal(expected);
        doc.verifyAll();
        langClient.verifyAll();
    }));
    test('Ensure symbols are returned - minimal', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file(__filename);
        // The test data is loosely based on the "full" test.
        const raw = [{
                name: 'SpamTests',
                kind: 5,
                range: {
                    start: { line: 2, character: 6 },
                    end: { line: 2, character: 15 }
                },
                children: [
                    {
                        name: 'test_all',
                        kind: 12,
                        range: {
                            start: { line: 3, character: 8 },
                            end: { line: 3, character: 16 }
                        },
                        children: [{
                                name: 'self',
                                kind: 13,
                                range: {
                                    start: { line: 3, character: 17 },
                                    end: { line: 3, character: 21 }
                                },
                                children: []
                            }]
                    }, {
                        name: 'assertTrue',
                        kind: 13,
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 0 }
                        },
                        children: []
                    }
                ]
            }];
        const expected = [
            new vscode_1.SymbolInformation('SpamTests', vscode_1.SymbolKind.Class, '', new vscode_1.Location(uri, new vscode_1.Range(2, 6, 2, 15))),
            new vscode_1.SymbolInformation('test_all', vscode_1.SymbolKind.Function, 'SpamTests', new vscode_1.Location(uri, new vscode_1.Range(3, 8, 3, 16))),
            new vscode_1.SymbolInformation('self', vscode_1.SymbolKind.Variable, 'test_all', new vscode_1.Location(uri, new vscode_1.Range(3, 17, 3, 21))),
            new vscode_1.SymbolInformation('assertTrue', vscode_1.SymbolKind.Variable, 'SpamTests', new vscode_1.Location(uri, new vscode_1.Range(0, 0, 0, 0)))
        ];
        const doc = createDoc(uri);
        const token = new vscode_1.CancellationTokenSource().token;
        const langClient = createLanguageClient(token, [
            [getRawDoc(uri), raw]
        ]);
        const provider = new symbolProvider_1.LanguageServerSymbolProvider(langClient.object);
        const items = yield provider.provideDocumentSymbols(doc.object, token);
        chai_1.expect(items).to.deep.equal(expected);
    }));
    test('Ensure symbols are returned - full', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file(__filename);
        // This is the raw symbol data returned by the language server which
        // gets converted to SymbolInformation[].  It was captured from an
        // actual VS Code session for a file with the following code:
        //
        //   import unittest
        //
        //   class SpamTests(unittest.TestCase):
        //       def test_all(self):
        //           self.assertTrue(False)
        //
        // See: LanguageServerSymbolProvider.provideDocumentSymbols()
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Change "raw" once the following issues are resolved:
        //  * https://github.com/Microsoft/python-language-server/issues/1
        //  * https://github.com/Microsoft/python-language-server/issues/2
        const raw = JSON.parse('[{"name":"SpamTests","detail":"SpamTests","kind":5,"deprecated":false,"range":{"start":{"line":2,"character":6},"end":{"line":2,"character":15}},"selectionRange":{"start":{"line":2,"character":6},"end":{"line":2,"character":15}},"children":[{"name":"test_all","detail":"test_all","kind":12,"deprecated":false,"range":{"start":{"line":3,"character":4},"end":{"line":4,"character":30}},"selectionRange":{"start":{"line":3,"character":4},"end":{"line":4,"character":30}},"children":[{"name":"self","detail":"self","kind":13,"deprecated":false,"range":{"start":{"line":3,"character":17},"end":{"line":3,"character":21}},"selectionRange":{"start":{"line":3,"character":17},"end":{"line":3,"character":21}},"children":[],"_functionKind":""}],"_functionKind":"function"},{"name":"assertTrue","detail":"assertTrue","kind":13,"deprecated":false,"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"selectionRange":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"children":[],"_functionKind":""}],"_functionKind":"class"}]');
        raw[0].children[0].range.start.character = 8;
        raw[0].children[0].range.end.line = 3;
        raw[0].children[0].range.end.character = 16;
        // This is the data from Jedi corresponding to same Python code
        // for which the raw data above was generated.
        // See: JediSymbolProvider.provideDocumentSymbols()
        const expectedRaw = JSON.parse('[{"name":"unittest","kind":1,"location":{"uri":{"$mid":1,"path":"<some file>","scheme":"file"},"range":[{"line":0,"character":7},{"line":0,"character":15}]},"containerName":""},{"name":"SpamTests","kind":4,"location":{"uri":{"$mid":1,"path":"<some file>","scheme":"file"},"range":[{"line":2,"character":0},{"line":4,"character":29}]},"containerName":""},{"name":"test_all","kind":11,"location":{"uri":{"$mid":1,"path":"<some file>","scheme":"file"},"range":[{"line":3,"character":4},{"line":4,"character":29}]},"containerName":"SpamTests"},{"name":"self","kind":12,"location":{"uri":{"$mid":1,"path":"<some file>","scheme":"file"},"range":[{"line":3,"character":17},{"line":3,"character":21}]},"containerName":"test_all"}]');
        expectedRaw[1].location.range[0].character = 6;
        expectedRaw[1].location.range[1].line = 2;
        expectedRaw[1].location.range[1].character = 15;
        expectedRaw[2].location.range[0].character = 8;
        expectedRaw[2].location.range[1].line = 3;
        expectedRaw[2].location.range[1].character = 16;
        const expected = normalizeSymbols(uri, expectedRaw);
        expected.shift(); // For now, drop the "unittest" symbol.
        expected.push(new vscode_1.SymbolInformation('assertTrue', vscode_1.SymbolKind.Variable, 'SpamTests', new vscode_1.Location(uri, new vscode_1.Range(0, 0, 0, 0))));
        const doc = createDoc(uri);
        const token = new vscode_1.CancellationTokenSource().token;
        const langClient = createLanguageClient(token, [
            [getRawDoc(uri), raw]
        ]);
        const provider = new symbolProvider_1.LanguageServerSymbolProvider(langClient.object);
        const items = yield provider.provideDocumentSymbols(doc.object, token);
        chai_1.expect(items).to.deep.equal(expected);
    }));
});
//################################
// helpers
function createDoc(uri, filename, isUntitled, text) {
    const doc = TypeMoq.Mock.ofType(undefined, TypeMoq.MockBehavior.Strict);
    if (uri !== undefined) {
        doc.setup(d => d.uri).returns(() => uri);
    }
    if (filename !== undefined) {
        doc.setup(d => d.fileName).returns(() => filename);
    }
    if (isUntitled !== undefined) {
        doc.setup(d => d.isUntitled).returns(() => isUntitled);
    }
    if (text !== undefined) {
        doc.setup(d => d.getText(TypeMoq.It.isAny())).returns(() => text);
    }
    return doc;
}
function createSymbols(uri, info) {
    const symbols = [];
    for (const [fullName, kind, range] of info) {
        const symbol = createSymbol(uri, fullName, kind, range);
        symbols.push(symbol);
    }
    return symbols;
}
function createSymbol(uri, fullName, kind, rawRange = '') {
    const [containerName, name] = string_1.splitParent(fullName);
    const range = text_1.parseRange(rawRange);
    const loc = new vscode_1.Location(uri, range);
    return new vscode_1.SymbolInformation(name, kind, containerName, loc);
}
function normalizeSymbols(uri, raw) {
    const symbols = [];
    for (const item of raw) {
        const symbol = new vscode_1.SymbolInformation(item.name, 
        // Type coercion is a bit fuzzy when it comes to enums, so we
        // play it safe by explicitly converting.
        vscode_1.SymbolKind[vscode_1.SymbolKind[item.kind]], item.containerName, new vscode_1.Location(uri, new vscode_1.Range(item.location.range[0].line, item.location.range[0].character, item.location.range[1].line, item.location.range[1].character)));
        symbols.push(symbol);
    }
    return symbols;
}
//# sourceMappingURL=symbolProvider.unit.test.js.map