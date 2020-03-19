"use strict";
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
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
const path = require("path");
const vscode = require("vscode");
const initialize_1 = require("../initialize");
const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const unformattedFile = path.join(formatFilesPath, 'fileToFormatOnEnter.py');
suite('Formatting - OnEnter provider', () => {
    let document;
    let editor;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        document = yield vscode.workspace.openTextDocument(unformattedFile);
        editor = yield vscode.window.showTextDocument(document);
    }));
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(initialize_1.closeActiveWindows);
    test('Simple statement', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(1, 0);
        assert.equal(text, 'x = 1', 'Line was not formatted');
    }));
    test('No formatting inside strings', () => __awaiter(this, void 0, void 0, function* () {
        let text = yield formatAtPosition(2, 0);
        assert.equal(text, '"""x=1', 'Text inside string was formatted');
        text = yield formatAtPosition(3, 0);
        assert.equal(text, '"""', 'Text inside string was formatted');
    }));
    test('Whitespace before comment', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(4, 0);
        assert.equal(text, '  # comment', 'Whitespace before comment was not preserved');
    }));
    test('No formatting of comment', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(5, 0);
        assert.equal(text, '# x=1', 'Text inside comment was formatted');
    }));
    test('Formatting line ending in comment', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(6, 0);
        assert.equal(text, 'x + 1  # ', 'Line ending in comment was not formatted');
    }));
    test('Formatting line with @', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(7, 0);
        assert.equal(text, '@x', 'Line with @ was reformatted');
    }));
    test('Formatting line with @', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(8, 0);
        assert.equal(text, 'x.y', 'Line ending with period was reformatted');
    }));
    test('Formatting line with unknown neighboring tokens', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(9, 0);
        assert.equal(text, 'if x <= 1:', 'Line with unknown neighboring tokens was not formatted');
    }));
    test('Formatting line with unknown neighboring tokens', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(10, 0);
        assert.equal(text, 'if 1 <= x:', 'Line with unknown neighboring tokens was not formatted');
    }));
    test('Formatting method definition with arguments', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(11, 0);
        assert.equal(text, 'def __init__(self, age=23)', 'Method definition with arguments was not formatted');
    }));
    test('Formatting space after open brace', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(12, 0);
        assert.equal(text, 'while (1)', 'Space after open brace was not formatted');
    }));
    test('Formatting line ending in string', () => __awaiter(this, void 0, void 0, function* () {
        const text = yield formatAtPosition(13, 0);
        assert.equal(text, 'x + """', 'Line ending in multiline string was not formatted');
    }));
    function formatAtPosition(line, character) {
        return __awaiter(this, void 0, void 0, function* () {
            const edits = yield vscode.commands.executeCommand('vscode.executeFormatOnTypeProvider', document.uri, new vscode.Position(line, character), '\n', { insertSpaces: true, tabSize: 2 });
            if (edits) {
                yield editor.edit(builder => edits.forEach(e => builder.replace(e.range, e.newText)));
            }
            return document.lineAt(line - 1).text;
        });
    }
});
//# sourceMappingURL=extension.onEnterFormat.test.js.map