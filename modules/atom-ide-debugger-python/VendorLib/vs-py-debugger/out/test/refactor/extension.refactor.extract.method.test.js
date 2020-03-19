"use strict";
// tslint:disable:interface-name no-any max-func-body-length estrict-plus-operands no-empty
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
const fs = require("fs-extra");
const path = require("path");
const vscode = require("vscode");
const configSettings_1 = require("../../client/common/configSettings");
const editor_1 = require("../../client/common/editor");
const simpleRefactorProvider_1 = require("../../client/providers/simpleRefactorProvider");
const proxy_1 = require("../../client/refactor/proxy");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const initialize_1 = require("./../initialize");
const mockClasses_1 = require("./../mockClasses");
const EXTENSION_DIR = path.join(__dirname, '..', '..', '..');
const refactorSourceFile = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
const refactorTargetFileDir = path.join(__dirname, '..', '..', '..', 'out', 'test', 'pythonFiles', 'refactoring', 'standAlone');
suite('Method Extraction', () => {
    // Hack hac hack
    const oldExecuteCommand = vscode.commands.executeCommand;
    const options = { cursorStyle: vscode.TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: vscode.TextEditorLineNumbersStyle.Off, tabSize: 4 };
    let refactorTargetFile = '';
    let ioc;
    suiteSetup(initialize_1.initialize);
    suiteTeardown(() => {
        vscode.commands.executeCommand = oldExecuteCommand;
        return initialize_1.closeActiveWindows();
    });
    setup(() => __awaiter(this, void 0, void 0, function* () {
        initializeDI();
        refactorTargetFile = path.join(refactorTargetFileDir, `refactor${new Date().getTime()}.py`);
        fs.copySync(refactorSourceFile, refactorTargetFile, { overwrite: true });
        yield initialize_1.initializeTest();
        vscode.commands.executeCommand = (cmd) => Promise.resolve();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        vscode.commands.executeCommand = oldExecuteCommand;
        try {
            yield fs.unlink(refactorTargetFile);
        }
        catch (_a) { }
        yield initialize_1.closeActiveWindows();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
    }
    function testingMethodExtraction(shouldError, startPos, endPos) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonSettings = configSettings_1.PythonSettings.getInstance(vscode.Uri.file(refactorTargetFile));
            const rangeOfTextToExtract = new vscode.Range(startPos, endPos);
            const proxy = new proxy_1.RefactorProxy(EXTENSION_DIR, pythonSettings, path.dirname(refactorTargetFile), ioc.serviceContainer);
            // tslint:disable-next-line:no-multiline-string
            const DIFF = `--- a/refactor.py\n+++ b/refactor.py\n@@ -237,9 +237,12 @@\n             try:\n                 self._process_request(self._input.readline())\n             except Exception as ex:\n-                message = ex.message + '  \\n' + traceback.format_exc()\n-                sys.stderr.write(str(len(message)) + ':' + message)\n-                sys.stderr.flush()\n+                self.myNewMethod(ex)\n+\n+    def myNewMethod(self, ex):\n+        message = ex.message + '  \\n' + traceback.format_exc()\n+        sys.stderr.write(str(len(message)) + ':' + message)\n+        sys.stderr.flush()\n \n if __name__ == '__main__':\n     RopeRefactoring().watch()\n`;
            const mockTextDoc = yield vscode.workspace.openTextDocument(refactorTargetFile);
            const expectedTextEdits = editor_1.getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
            try {
                const response = yield proxy.extractMethod(mockTextDoc, 'myNewMethod', refactorTargetFile, rangeOfTextToExtract, options);
                if (shouldError) {
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                const textEdits = editor_1.getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
                assert.equal(response.results.length, 1, 'Invalid number of items in response');
                assert.equal(textEdits.length, expectedTextEdits.length, 'Invalid number of Text Edits');
                textEdits.forEach(edit => {
                    const foundEdit = expectedTextEdits.filter(item => item.newText === edit.newText && item.range.isEqual(edit.range));
                    assert.equal(foundEdit.length, 1, 'Edit not found');
                });
            }
            catch (error) {
                if (!shouldError) {
                    // Wait a minute this shouldn't work, what's going on
                    assert.equal('Error', 'No error', `${error}`);
                }
            }
        });
    }
    test('Extract Method', () => __awaiter(this, void 0, void 0, function* () {
        const startPos = new vscode.Position(239, 0);
        const endPos = new vscode.Position(241, 35);
        yield testingMethodExtraction(false, startPos, endPos);
    }));
    test('Extract Method will fail if complete statements are not selected', () => __awaiter(this, void 0, void 0, function* () {
        const startPos = new vscode.Position(239, 30);
        const endPos = new vscode.Position(241, 35);
        yield testingMethodExtraction(true, startPos, endPos);
    }));
    function testingMethodExtractionEndToEnd(shouldError, startPos, endPos) {
        return __awaiter(this, void 0, void 0, function* () {
            const ch = new mockClasses_1.MockOutputChannel('Python');
            const rangeOfTextToExtract = new vscode.Range(startPos, endPos);
            const textDocument = yield vscode.workspace.openTextDocument(refactorTargetFile);
            const editor = yield vscode.window.showTextDocument(textDocument);
            editor.selections = [new vscode.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end)];
            editor.selection = new vscode.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end);
            try {
                yield simpleRefactorProvider_1.extractMethod(EXTENSION_DIR, editor, rangeOfTextToExtract, ch, ioc.serviceContainer);
                if (shouldError) {
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                const newMethodRefLine = textDocument.lineAt(editor.selection.start);
                assert.equal(ch.output.length, 0, 'Output channel is not empty');
                assert.equal(textDocument.lineAt(newMethodRefLine.lineNumber + 2).text.trim().indexOf('def newmethod'), 0, 'New Method not created');
                assert.equal(newMethodRefLine.text.trim().startsWith('self.newmethod'), true, 'New Method not being used');
            }
            catch (error) {
                if (!shouldError) {
                    assert.equal('Error', 'No error', `${error}`);
                }
            }
        });
    }
    // This test fails on linux (text document not getting updated in time)
    test('Extract Method (end to end)', () => __awaiter(this, void 0, void 0, function* () {
        const startPos = new vscode.Position(239, 0);
        const endPos = new vscode.Position(241, 35);
        yield testingMethodExtractionEndToEnd(false, startPos, endPos);
    }));
    test('Extract Method will fail if complete statements are not selected', () => __awaiter(this, void 0, void 0, function* () {
        const startPos = new vscode.Position(239, 30);
        const endPos = new vscode.Position(241, 35);
        yield testingMethodExtractionEndToEnd(true, startPos, endPos);
    }));
});
//# sourceMappingURL=extension.refactor.extract.method.test.js.map