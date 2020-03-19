"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const os_1 = require("os");
const path = require("path");
const vscode = require("vscode");
const constants_1 = require("../constants");
const initialize_1 = require("../initialize");
const textUtils_1 = require("../textUtils");
const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const hoverPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'hover');
const fileOne = path.join(autoCompPath, 'one.py');
const fileThree = path.join(autoCompPath, 'three.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');
const fileHover = path.join(autoCompPath, 'hoverTest.py');
const fileStringFormat = path.join(hoverPath, 'functionHover.py');
// tslint:disable-next-line:max-func-body-length
suite('Hover Definition (Jedi)', () => {
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (constants_1.IsLanguageServerTest()) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            yield initialize_1.initialize();
        });
    });
    setup(initialize_1.initializeTest);
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(initialize_1.closeActiveWindows);
    test('Method', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(30, 5);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '30,4', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '30,11', 'End position is incorrect');
            assert.equal(def[0].contents.length, 1, 'Invalid content items');
            // tslint:disable-next-line:prefer-template
            const expectedContent = '```python' + os_1.EOL + 'def method1()' + os_1.EOL + '```' + os_1.EOL + 'This is method1';
            assert.equal(textUtils_1.normalizeMarkedString(def[0].contents[0]), expectedContent, 'function signature incorrect');
        }).then(done, done);
    });
    test('Across files', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileThree).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(1, 12);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '1,9', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '1,12', 'End position is incorrect');
            // tslint:disable-next-line:prefer-template
            assert.equal(textUtils_1.normalizeMarkedString(def[0].contents[0]), '```python' + os_1.EOL + 'def fun()' + os_1.EOL + '```' + os_1.EOL + 'This is fun', 'Invalid conents');
        }).then(done, done);
    });
    test('With Unicode Characters', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileEncoding).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(25, 6);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '25,4', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '25,7', 'End position is incorrect');
            // tslint:disable-next-line:prefer-template
            assert.equal(textUtils_1.normalizeMarkedString(def[0].contents[0]), '```python' + os_1.EOL + 'def bar()' + os_1.EOL + '```' + os_1.EOL +
                '说明 - keep this line, it works' + os_1.EOL + 'delete following line, it works' +
                os_1.EOL + '如果存在需要等待审批或正在执行的任务，将不刷新页面', 'Invalid conents');
        }).then(done, done);
    });
    test('Across files with Unicode Characters', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileEncodingUsed).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(1, 11);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '1,5', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '1,16', 'End position is incorrect');
            // tslint:disable-next-line:prefer-template
            assert.equal(textUtils_1.normalizeMarkedString(def[0].contents[0]), '```python' + os_1.EOL +
                'def showMessage()' + os_1.EOL +
                '```' + os_1.EOL +
                'Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи. ' + os_1.EOL +
                'Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.', 'Invalid conents');
        }).then(done, done);
    });
    test('Nothing for keywords (class)', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(5, 1);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(def => {
            assert.equal(def.length, 0, 'Definition length is incorrect');
        }).then(done, done);
    });
    test('Nothing for keywords (for)', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileHover).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(3, 1);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(def => {
            assert.equal(def.length, 0, 'Definition length is incorrect');
        }).then(done, done);
    });
    test('Highlighting Class', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileHover).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(11, 15);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '11,12', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '11,18', 'End position is incorrect');
            // tslint:disable-next-line:prefer-template
            const documentation = '```python' + os_1.EOL +
                'class Random(x=None)' + os_1.EOL +
                '```' + os_1.EOL +
                'Random number generator base class used by bound module functions.' + os_1.EOL +
                '' + os_1.EOL +
                'Used to instantiate instances of Random to get generators that don\'t' + os_1.EOL +
                'share state.' + os_1.EOL +
                '' + os_1.EOL +
                'Class Random can also be subclassed if you want to use a different basic' + os_1.EOL +
                'generator of your own devising: in that case, override the following' + os_1.EOL +
                'methods: random(), seed(), getstate(), and setstate().' + os_1.EOL +
                'Optionally, implement a getrandbits() method so that randrange()' + os_1.EOL +
                'can cover arbitrarily large ranges.';
            assert.equal(textUtils_1.normalizeMarkedString(def[0].contents[0]), documentation, 'Invalid conents');
        }).then(done, done);
    });
    test('Highlight Method', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileHover).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(12, 10);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '12,5', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '12,12', 'End position is incorrect');
            // tslint:disable-next-line:prefer-template
            assert.equal(textUtils_1.normalizeMarkedString(def[0].contents[0]), '```python' + os_1.EOL +
                'def randint(a, b)' + os_1.EOL +
                '```' + os_1.EOL +
                'Return random integer in range [a, b], including both end points.', 'Invalid conents');
        }).then(done, done);
    });
    test('Highlight Function', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileHover).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(8, 14);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '8,11', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '8,15', 'End position is incorrect');
            // tslint:disable-next-line:prefer-template
            assert.equal(textUtils_1.normalizeMarkedString(def[0].contents[0]), '```python' + os_1.EOL +
                'def acos(x)' + os_1.EOL +
                '```' + os_1.EOL +
                'Return the arc cosine (measured in radians) of x.', 'Invalid conents');
        }).then(done, done);
    });
    test('Highlight Multiline Method Signature', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileHover).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(14, 14);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '14,9', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '14,15', 'End position is incorrect');
            // tslint:disable-next-line:prefer-template
            assert.equal(textUtils_1.normalizeMarkedString(def[0].contents[0]), '```python' + os_1.EOL +
                'class Thread(group=None, target=None, name=None, args=(), kwargs=None, verbose=None)' + os_1.EOL +
                '```' + os_1.EOL +
                'A class that represents a thread of control.' + os_1.EOL +
                '' + os_1.EOL +
                'This class can be safely subclassed in a limited fashion.', 'Invalid content items');
        }).then(done, done);
    });
    test('Variable', done => {
        let textDocument;
        vscode.workspace.openTextDocument(fileHover).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(6, 2);
            return vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        }).then(result => {
            const def = result;
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(def[0].contents.length, 1, 'Only expected one result');
            const contents = textUtils_1.normalizeMarkedString(def[0].contents[0]);
            if (contents.indexOf('```python') === -1) {
                assert.fail(contents, '', 'First line is incorrect', 'compare');
            }
            if (contents.indexOf('rnd: Random') === -1) {
                assert.fail(contents, '', 'Variable name or type are missing', 'compare');
            }
        }).then(done, done);
    });
    test('Hover over method shows proper text.', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode.workspace.openTextDocument(fileStringFormat);
        yield vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(8, 4);
        const def = (yield vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position));
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(def[0].contents.length, 1, 'Only expected one result');
        const contents = textUtils_1.normalizeMarkedString(def[0].contents[0]);
        if (contents.indexOf('def my_func') === -1) {
            assert.fail(contents, '', '\'def my_func\' is missing', 'compare');
        }
        if (contents.indexOf('This is a test.') === -1 &&
            contents.indexOf('It also includes this text, too.') === -1) {
            assert.fail(contents, '', 'Expected custom function text missing', 'compare');
        }
    }));
});
//# sourceMappingURL=hover.jedi.test.js.map