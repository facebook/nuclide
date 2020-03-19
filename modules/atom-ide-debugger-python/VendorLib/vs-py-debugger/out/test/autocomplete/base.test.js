"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-unused-variable
const assert = require("assert");
const path = require("path");
const vscode = require("vscode");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const fileOne = path.join(autoCompPath, 'one.py');
const fileImport = path.join(autoCompPath, 'imp.py');
const fileDoc = path.join(autoCompPath, 'doc.py');
const fileLambda = path.join(autoCompPath, 'lamb.py');
const fileDecorator = path.join(autoCompPath, 'deco.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');
const fileSuppress = path.join(autoCompPath, 'suppress.py');
// tslint:disable-next-line:max-func-body-length
suite('Autocomplete', function () {
    // Attempt to fix #1301
    // tslint:disable-next-line:no-invalid-this
    this.timeout(60000);
    let isPython2;
    let ioc;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // Attempt to fix #1301
            // tslint:disable-next-line:no-invalid-this
            this.timeout(60000);
            yield initialize_1.initialize();
            initializeDI();
            isPython2 = (yield ioc.getPythonMajorVersion(common_1.rootWorkspaceUri)) === 2;
        });
    });
    setup(initialize_1.initializeTest);
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.closeActiveWindows();
        ioc.dispose();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }
    test('For "sys."', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(3, 10);
            return vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.equal(list.items.filter(item => item.label === 'api_version').length, 1, 'api_version not found');
        }).then(done, done);
    });
    // https://github.com/DonJayamanne/pythonVSCode/issues/975
    test('For "import *"', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode.workspace.openTextDocument(fileImport);
        yield vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(1, 4);
        const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.equal(list.items.filter(item => item.label === 'fstat').length, 1, 'fstat not found');
    }));
    // https://github.com/DonJayamanne/pythonVSCode/issues/898
    test('For "f.readlines()"', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode.workspace.openTextDocument(fileDoc);
        yield vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(5, 27);
        const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        // These are not known to work, jedi issue
        // assert.equal(list.items.filter(item => item.label === 'capitalize').length, 1, 'capitalize not found (known not to work, Jedi issue)');
        // assert.notEqual(list.items.filter(item => item.label === 'upper').length, 1, 'upper not found');
        // assert.notEqual(list.items.filter(item => item.label === 'lower').length, 1, 'lower not found');
    }));
    // https://github.com/DonJayamanne/pythonVSCode/issues/265
    test('For "lambda"', function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (isPython2) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
                return;
            }
            const textDocument = yield vscode.workspace.openTextDocument(fileLambda);
            yield vscode.window.showTextDocument(textDocument);
            const position = new vscode.Position(1, 19);
            const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
            assert.notEqual(list.items.filter(item => item.label === 'append').length, 0, 'append not found');
            assert.notEqual(list.items.filter(item => item.label === 'clear').length, 0, 'clear not found');
            assert.notEqual(list.items.filter(item => item.label === 'count').length, 0, 'cound not found');
        });
    });
    // https://github.com/DonJayamanne/pythonVSCode/issues/630
    test('For "abc.decorators"', () => __awaiter(this, void 0, void 0, function* () {
        // Disabled for the Language Server, see https://github.com/Microsoft/PTVS/issues/3857
        if (initialize_1.IsLanguageServerTest()) {
            return;
        }
        const textDocument = yield vscode.workspace.openTextDocument(fileDecorator);
        yield vscode.window.showTextDocument(textDocument);
        let position = new vscode.Position(3, 9);
        let list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(list.items.filter(item => item.label === 'abstractmethod').length, 0, 'abstractmethod not found');
        position = new vscode.Position(4, 9);
        list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(list.items.filter(item => item.label === 'abstractmethod').length, 0, 'abstractmethod not found');
        position = new vscode.Position(2, 30);
        list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'ABCMeta').length, 0, 'ABCMeta not found');
        assert.notEqual(list.items.filter(item => item.label === 'abstractmethod').length, 0, 'abstractmethod not found');
    }));
    // https://github.com/DonJayamanne/pythonVSCode/issues/727
    // https://github.com/DonJayamanne/pythonVSCode/issues/746
    // https://github.com/davidhalter/jedi/issues/859
    test('For "time.slee"', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode.workspace.openTextDocument(fileDoc);
        yield vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(10, 9);
        const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        const items = list.items.filter(item => item.label === 'sleep');
        assert.notEqual(items.length, 0, 'sleep not found');
        checkDocumentation(items[0], 'Delay execution for a given number of seconds.  The argument may be');
    }));
    test('For custom class', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(30, 4);
            return vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            assert.notEqual(list.items.filter(item => item.label === 'method1').length, 0, 'method1 not found');
            assert.notEqual(list.items.filter(item => item.label === 'method2').length, 0, 'method2 not found');
        }).then(done, done);
    });
    test('With Unicode Characters', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileEncoding).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(25, 4);
            return vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            const items = list.items.filter(item => item.label === 'bar');
            assert.equal(items.length, 1, 'bar not found');
            const expected1 = '说明 - keep this line, it works';
            checkDocumentation(items[0], expected1);
            const expected2 = '如果存在需要等待审批或正在执行的任务，将不刷新页面';
            checkDocumentation(items[0], expected2);
        }).then(done, done);
    });
    test('Across files With Unicode Characters', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileEncodingUsed).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(1, 5);
            return vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        }).then(list => {
            let items = list.items.filter(item => item.label === 'Foo');
            assert.equal(items.length, 1, 'Foo not found');
            checkDocumentation(items[0], '说明');
            items = list.items.filter(item => item.label === 'showMessage');
            assert.equal(items.length, 1, 'showMessage not found');
            const expected1 = 'Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи.';
            checkDocumentation(items[0], expected1);
            const expected2 = 'Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.';
            checkDocumentation(items[0], expected2);
        }).then(done, done);
    });
    // https://github.com/Microsoft/vscode-python/issues/110
    test('Suppress in strings/comments', () => __awaiter(this, void 0, void 0, function* () {
        // Excluded from the Language Server b/c skipping of strings and comments
        // is not yet there. See https://github.com/Microsoft/PTVS/issues/3798
        if (initialize_1.IsLanguageServerTest()) {
            return;
        }
        const positions = [
            new vscode.Position(0, 1),
            new vscode.Position(0, 9),
            new vscode.Position(0, 12),
            new vscode.Position(1, 1),
            new vscode.Position(1, 3),
            new vscode.Position(2, 7),
            new vscode.Position(3, 0),
            new vscode.Position(4, 2),
            new vscode.Position(4, 8),
            new vscode.Position(5, 4),
            new vscode.Position(5, 10) // false
        ];
        const expected = [
            false, true, false, false, false, false, false, false, false, false, false
        ];
        const textDocument = yield vscode.workspace.openTextDocument(fileSuppress);
        yield vscode.window.showTextDocument(textDocument);
        for (let i = 0; i < positions.length; i += 1) {
            const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, positions[i]);
            const result = list.items.filter(item => item.label === 'abs').length;
            assert.equal(result > 0, expected[i], `Expected ${expected[i]} at position ${positions[i].line}:${positions[i].character} but got ${result}`);
        }
    }));
});
// tslint:disable-next-line:no-any
function checkDocumentation(item, expectedContains) {
    let isValidType = false;
    let documentation;
    if (typeof item.documentation === 'string') {
        isValidType = true;
        documentation = item.documentation;
    }
    else {
        documentation = item.documentation.value;
        isValidType = documentation !== undefined && documentation !== null;
    }
    assert.equal(isValidType, true, 'Documentation is neither string nor vscode.MarkdownString');
    const inDoc = documentation.indexOf(expectedContains) >= 0;
    assert.equal(inDoc, true, 'Documentation incorrect');
}
//# sourceMappingURL=base.test.js.map