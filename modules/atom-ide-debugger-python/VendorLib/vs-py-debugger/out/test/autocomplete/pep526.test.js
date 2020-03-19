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
const assert = require("assert");
const path = require("path");
const vscode = require("vscode");
const platform_1 = require("../../client/common/utils/platform");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const filePep526 = path.join(autoCompPath, 'pep526.py');
// tslint:disable-next-line:max-func-body-length
suite('Autocomplete PEP 526', () => {
    let isPython2;
    let ioc;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // https://github.com/Microsoft/PTVS/issues/3917
            if (initialize_1.IsLanguageServerTest()) {
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
    test('variable (abc:str)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 3.4 and 3.5 under
            // Windows and macOS.Tracked by #2545.
            if (common_1.isOs(platform_1.OSType.Windows, platform_1.OSType.OSX)) {
                if (yield common_1.isPythonVersion('3.4', '3.5')) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            }
            const textDocument = yield vscode.workspace.openTextDocument(filePep526);
            yield vscode.window.showTextDocument(textDocument);
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(9, 8);
            const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
            assert.notEqual(list.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
            assert.notEqual(list.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
            assert.notEqual(list.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
        });
    });
    test('variable (abc: str = "")', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 3.4 and 3.5 under
            // Windows and macOS.Tracked by #2545.
            if (common_1.isOs(platform_1.OSType.Windows, platform_1.OSType.OSX)) {
                if (yield common_1.isPythonVersion('3.4', '3.5')) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            }
            const textDocument = yield vscode.workspace.openTextDocument(filePep526);
            yield vscode.window.showTextDocument(textDocument);
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(8, 14);
            const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
            assert.notEqual(list.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
            assert.notEqual(list.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
            assert.notEqual(list.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
        });
    });
    test('variable (abc = UNKNOWN # type: str)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 3.4 and 3.5 under
            // Windows and macOS.Tracked by #2545.
            if (common_1.isOs(platform_1.OSType.Windows, platform_1.OSType.OSX)) {
                if (yield common_1.isPythonVersion('3.4', '3.5')) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            }
            const textDocument = yield vscode.workspace.openTextDocument(filePep526);
            yield vscode.window.showTextDocument(textDocument);
            assert(vscode.window.activeTextEditor, 'No active editor');
            const position = new vscode.Position(7, 14);
            const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
            assert.notEqual(list.items.filter(item => item.label === 'capitalize').length, 0, 'capitalize not found');
            assert.notEqual(list.items.filter(item => item.label === 'upper').length, 0, 'upper not found');
            assert.notEqual(list.items.filter(item => item.label === 'lower').length, 0, 'lower not found');
        });
    });
    test('class methods', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 3.4 and 3.5 under
            // Windows and macOS.Tracked by #2545.
            if (common_1.isOs(platform_1.OSType.Windows, platform_1.OSType.OSX)) {
                if (yield common_1.isPythonVersion('3.4', '3.5')) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            }
            const textDocument = yield vscode.workspace.openTextDocument(filePep526);
            yield vscode.window.showTextDocument(textDocument);
            assert(vscode.window.activeTextEditor, 'No active editor');
            let position = new vscode.Position(20, 4);
            let list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
            assert.notEqual(list.items.filter(item => item.label === 'a').length, 0, 'method a not found');
            position = new vscode.Position(21, 4);
            list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
            assert.notEqual(list.items.filter(item => item.label === 'b').length, 0, 'method b not found');
        });
    });
    test('class method types', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode.workspace.openTextDocument(filePep526);
        yield vscode.window.showTextDocument(textDocument);
        assert(vscode.window.activeTextEditor, 'No active editor');
        const position = new vscode.Position(21, 6);
        const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.notEqual(list.items.filter(item => item.label === 'bit_length').length, 0, 'bit_length not found');
    }));
});
//# sourceMappingURL=pep526.test.js.map