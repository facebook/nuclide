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
const vscode_1 = require("vscode");
const configSettings_1 = require("../../client/common/configSettings");
const editor_1 = require("../../client/common/editor");
const simpleRefactorProvider_1 = require("../../client/providers/simpleRefactorProvider");
const proxy_1 = require("../../client/refactor/proxy");
const common_1 = require("../common");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const initialize_1 = require("./../initialize");
const mockClasses_1 = require("./../mockClasses");
const EXTENSION_DIR = path.join(__dirname, '..', '..', '..');
const refactorSourceFile = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
const refactorTargetFileDir = path.join(__dirname, '..', '..', '..', 'out', 'test', 'pythonFiles', 'refactoring', 'standAlone');
suite('Variable Extraction', () => {
    // Hack hac hack
    const oldExecuteCommand = vscode_1.commands.executeCommand;
    const options = { cursorStyle: vscode_1.TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: vscode_1.TextEditorLineNumbersStyle.Off, tabSize: 4 };
    let refactorTargetFile = '';
    let ioc;
    suiteSetup(initialize_1.initialize);
    suiteTeardown(() => {
        vscode_1.commands.executeCommand = oldExecuteCommand;
        return initialize_1.closeActiveWindows();
    });
    setup(() => __awaiter(this, void 0, void 0, function* () {
        initializeDI();
        refactorTargetFile = path.join(refactorTargetFileDir, `refactor${new Date().getTime()}.py`);
        fs.copySync(refactorSourceFile, refactorTargetFile, { overwrite: true });
        yield initialize_1.initializeTest();
        vscode_1.commands.executeCommand = (cmd) => Promise.resolve();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        vscode_1.commands.executeCommand = oldExecuteCommand;
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
    function testingVariableExtraction(shouldError, startPos, endPos) {
        return __awaiter(this, void 0, void 0, function* () {
            const pythonSettings = configSettings_1.PythonSettings.getInstance(vscode_1.Uri.file(refactorTargetFile));
            const rangeOfTextToExtract = new vscode_1.Range(startPos, endPos);
            const proxy = new proxy_1.RefactorProxy(EXTENSION_DIR, pythonSettings, path.dirname(refactorTargetFile), ioc.serviceContainer);
            const DIFF = '--- a/refactor.py\n+++ b/refactor.py\n@@ -232,7 +232,8 @@\n         sys.stdout.flush()\n \n     def watch(self):\n-        self._write_response("STARTED")\n+        myNewVariable = "STARTED"\n+        self._write_response(myNewVariable)\n         while True:\n             try:\n                 self._process_request(self._input.readline())\n';
            const mockTextDoc = yield vscode_1.workspace.openTextDocument(refactorTargetFile);
            const expectedTextEdits = editor_1.getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
            try {
                const response = yield proxy.extractVariable(mockTextDoc, 'myNewVariable', refactorTargetFile, rangeOfTextToExtract, options);
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
                    assert.equal('Error', 'No error', `${error}`);
                }
            }
        });
    }
    // tslint:disable-next-line:no-function-expression
    test('Extract Variable', function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (common_1.isPythonVersion('3.7')) {
                // tslint:disable-next-line:no-invalid-this
                return this.skip();
            }
            else {
                const startPos = new vscode_1.Position(234, 29);
                const endPos = new vscode_1.Position(234, 38);
                yield testingVariableExtraction(false, startPos, endPos);
            }
        });
    });
    test('Extract Variable fails if whole string not selected', () => __awaiter(this, void 0, void 0, function* () {
        const startPos = new vscode_1.Position(234, 20);
        const endPos = new vscode_1.Position(234, 38);
        yield testingVariableExtraction(true, startPos, endPos);
    }));
    function testingVariableExtractionEndToEnd(shouldError, startPos, endPos) {
        return __awaiter(this, void 0, void 0, function* () {
            const ch = new mockClasses_1.MockOutputChannel('Python');
            const rangeOfTextToExtract = new vscode_1.Range(startPos, endPos);
            const textDocument = yield vscode_1.workspace.openTextDocument(refactorTargetFile);
            const editor = yield vscode_1.window.showTextDocument(textDocument);
            editor.selections = [new vscode_1.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end)];
            editor.selection = new vscode_1.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end);
            try {
                yield simpleRefactorProvider_1.extractVariable(EXTENSION_DIR, editor, rangeOfTextToExtract, ch, ioc.serviceContainer);
                if (shouldError) {
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                assert.equal(ch.output.length, 0, 'Output channel is not empty');
                const newVarDefLine = textDocument.lineAt(editor.selection.start);
                const newVarRefLine = textDocument.lineAt(newVarDefLine.lineNumber + 1);
                assert.equal(newVarDefLine.text.trim().indexOf('newvariable'), 0, 'New Variable not created');
                assert.equal(newVarDefLine.text.trim().endsWith('= "STARTED"'), true, 'Started Text Assigned to variable');
                assert.equal(newVarRefLine.text.indexOf('(newvariable') >= 0, true, 'New Variable not being used');
            }
            catch (error) {
                if (!shouldError) {
                    assert.fail('Error', 'No error', `${error}`);
                }
            }
        });
    }
    // This test fails on linux (text document not getting updated in time)
    if (!initialize_1.IS_CI_SERVER) {
        test('Extract Variable (end to end)', () => __awaiter(this, void 0, void 0, function* () {
            const startPos = new vscode_1.Position(234, 29);
            const endPos = new vscode_1.Position(234, 38);
            yield testingVariableExtractionEndToEnd(false, startPos, endPos);
        }));
    }
    test('Extract Variable fails if whole string not selected (end to end)', () => __awaiter(this, void 0, void 0, function* () {
        const startPos = new vscode_1.Position(234, 20);
        const endPos = new vscode_1.Position(234, 38);
        yield testingVariableExtractionEndToEnd(true, startPos, endPos);
    }));
});
//# sourceMappingURL=extension.refactor.extract.var.test.js.map