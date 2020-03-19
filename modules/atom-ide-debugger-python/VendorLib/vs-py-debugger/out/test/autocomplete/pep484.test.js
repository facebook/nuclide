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
const path = require("path");
const vscode = require("vscode");
const common_1 = require("../common");
const constants_1 = require("../constants");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const filePep484 = path.join(autoCompPath, 'pep484.py');
suite('Autocomplete PEP 484', () => {
    let isPython2;
    let ioc;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // https://github.com/Microsoft/PTVS/issues/3917
            if (constants_1.IsLanguageServerTest()) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            yield initialize_1.initialize();
            initializeDI();
            isPython2 = (yield ioc.getPythonMajorVersion(common_1.rootWorkspaceUri)) === 2;
            if (isPython2) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
                return;
            }
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
    test('argument', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode.workspace.openTextDocument(filePep484);
        yield vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(2, 27);
        const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
        assert.notEqual(list.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
        assert.notEqual(list.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
    }));
    test('return value', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode.workspace.openTextDocument(filePep484);
        yield vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(8, 6);
        const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'bit_length').length, 0, 'bit_length not found');
        assert.notEqual(list.items.filter(item => item.label === 'from_bytes').length, 0, 'from_bytes not found');
    }));
});
//# sourceMappingURL=pep484.test.js.map