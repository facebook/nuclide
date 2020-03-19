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
const chai_1 = require("chai");
const fs = require("fs");
const os_1 = require("os");
const path = require("path");
const vscode_1 = require("vscode");
const constants_1 = require("../../client/common/constants");
const importSortProvider_1 = require("../../client/providers/importSortProvider");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const sortingPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'sorting');
const fileToFormatWithoutConfig = path.join(sortingPath, 'noconfig', 'before.py');
const originalFileToFormatWithoutConfig = path.join(sortingPath, 'noconfig', 'original.py');
const fileToFormatWithConfig = path.join(sortingPath, 'withconfig', 'before.py');
const originalFileToFormatWithConfig = path.join(sortingPath, 'withconfig', 'original.py');
const fileToFormatWithConfig1 = path.join(sortingPath, 'withconfig', 'before.1.py');
const originalFileToFormatWithConfig1 = path.join(sortingPath, 'withconfig', 'original.1.py');
// tslint:disable-next-line:max-func-body-length
suite('Sortingx', () => {
    let ioc;
    let sorter;
    const configTarget = initialize_1.IS_MULTI_ROOT_TEST ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Workspace;
    suiteSetup(initialize_1.initialize);
    suiteTeardown(() => __awaiter(this, void 0, void 0, function* () {
        fs.writeFileSync(fileToFormatWithConfig, fs.readFileSync(originalFileToFormatWithConfig));
        fs.writeFileSync(fileToFormatWithConfig1, fs.readFileSync(originalFileToFormatWithConfig1));
        fs.writeFileSync(fileToFormatWithoutConfig, fs.readFileSync(originalFileToFormatWithoutConfig));
        yield common_1.updateSetting('sortImports.args', [], vscode_1.Uri.file(sortingPath), configTarget);
        yield initialize_1.closeActiveWindows();
    }));
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initializeTest();
        initializeDI();
        fs.writeFileSync(fileToFormatWithConfig, fs.readFileSync(originalFileToFormatWithConfig));
        fs.writeFileSync(fileToFormatWithoutConfig, fs.readFileSync(originalFileToFormatWithoutConfig));
        fs.writeFileSync(fileToFormatWithConfig1, fs.readFileSync(originalFileToFormatWithConfig1));
        yield common_1.updateSetting('sortImports.args', [], vscode_1.Uri.file(sortingPath), configTarget);
        yield initialize_1.closeActiveWindows();
        sorter = new importSortProvider_1.SortImportsEditingProvider(ioc.serviceContainer);
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield initialize_1.closeActiveWindows();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }
    test('Without Config', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode_1.workspace.openTextDocument(fileToFormatWithoutConfig);
        yield vscode_1.window.showTextDocument(textDocument);
        const edit = (yield sorter.provideDocumentSortImportsEdits(textDocument.uri));
        chai_1.expect(edit.entries()).to.be.lengthOf(1);
        const edits = edit.entries()[0][1];
        assert.equal(edits.filter(value => value.newText === os_1.EOL && value.range.isEqual(new vscode_1.Range(2, 0, 2, 0))).length, 1, 'EOL not found');
        assert.equal(edits.filter(value => value.newText === '' && value.range.isEqual(new vscode_1.Range(3, 0, 4, 0))).length, 1, '"" not found');
        assert.equal(edits.filter(value => value.newText === `from rope.base import libutils${os_1.EOL}from rope.refactor.extract import ExtractMethod, ExtractVariable${os_1.EOL}from rope.refactor.rename import Rename${os_1.EOL}` && value.range.isEqual(new vscode_1.Range(6, 0, 6, 0))).length, 1, 'Text not found');
        assert.equal(edits.filter(value => value.newText === '' && value.range.isEqual(new vscode_1.Range(13, 0, 18, 0))).length, 1, '"" not found');
    }));
    test('Without Config (via Command)', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode_1.workspace.openTextDocument(fileToFormatWithoutConfig);
        const originalContent = textDocument.getText();
        yield vscode_1.window.showTextDocument(textDocument);
        yield vscode_1.commands.executeCommand(constants_1.Commands.Sort_Imports);
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    }));
    test('With Config', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode_1.workspace.openTextDocument(fileToFormatWithConfig);
        yield vscode_1.window.showTextDocument(textDocument);
        const edit = (yield sorter.provideDocumentSortImportsEdits(textDocument.uri));
        chai_1.expect(edit.entries()).to.be.lengthOf(1);
        const edits = edit.entries()[0][1];
        const newValue = `from third_party import lib2${os_1.EOL}from third_party import lib3${os_1.EOL}from third_party import lib4${os_1.EOL}from third_party import lib5${os_1.EOL}from third_party import lib6${os_1.EOL}from third_party import lib7${os_1.EOL}from third_party import lib8${os_1.EOL}from third_party import lib9${os_1.EOL}`;
        assert.equal(edits.filter(value => value.newText === newValue && value.range.isEqual(new vscode_1.Range(0, 0, 3, 0))).length, 1, 'New Text not found');
    }));
    test('With Config (via Command)', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode_1.workspace.openTextDocument(fileToFormatWithConfig);
        const originalContent = textDocument.getText();
        yield vscode_1.window.showTextDocument(textDocument);
        yield vscode_1.commands.executeCommand(constants_1.Commands.Sort_Imports);
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    }));
    test('With Changes and Config in Args', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('sortImports.args', ['-sp', path.join(sortingPath, 'withconfig')], vscode_1.Uri.file(sortingPath), vscode_1.ConfigurationTarget.Workspace);
        const textDocument = yield vscode_1.workspace.openTextDocument(fileToFormatWithConfig);
        const editor = yield vscode_1.window.showTextDocument(textDocument);
        yield editor.edit(builder => {
            builder.insert(new vscode_1.Position(0, 0), `from third_party import lib0${os_1.EOL}`);
        });
        const edit = (yield sorter.provideDocumentSortImportsEdits(textDocument.uri));
        chai_1.expect(edit.entries()).to.be.lengthOf(1);
        const edits = edit.entries()[0][1];
        assert.notEqual(edits.length, 0, 'No edits');
    }));
    test('With Changes and Config in Args (via Command)', () => __awaiter(this, void 0, void 0, function* () {
        yield common_1.updateSetting('sortImports.args', ['-sp', path.join(sortingPath, 'withconfig')], vscode_1.Uri.file(sortingPath), configTarget);
        const textDocument = yield vscode_1.workspace.openTextDocument(fileToFormatWithConfig);
        const editor = yield vscode_1.window.showTextDocument(textDocument);
        yield editor.edit(builder => {
            builder.insert(new vscode_1.Position(0, 0), `from third_party import lib0${os_1.EOL}`);
        });
        const originalContent = textDocument.getText();
        yield vscode_1.commands.executeCommand(constants_1.Commands.Sort_Imports);
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    }));
});
//# sourceMappingURL=extension.sort.test.js.map