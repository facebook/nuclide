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
// tslint:disable:no-any max-func-body-length
const chai_1 = require("chai");
const os_1 = require("os");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const constants_1 = require("../../client/common/constants");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/process/types");
const types_4 = require("../../client/common/types");
const misc_1 = require("../../client/common/utils/misc");
const importSortProvider_1 = require("../../client/providers/importSortProvider");
suite('Import Sort Provider', () => {
    let serviceContainer;
    let shell;
    let documentManager;
    let configurationService;
    let pythonExecFactory;
    let processServiceFactory;
    let editorUtils;
    let commandManager;
    let pythonSettings;
    let sortProvider;
    let fs;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType();
        commandManager = TypeMoq.Mock.ofType();
        fs = TypeMoq.Mock.ofType();
        documentManager = TypeMoq.Mock.ofType();
        shell = TypeMoq.Mock.ofType();
        configurationService = TypeMoq.Mock.ofType();
        pythonExecFactory = TypeMoq.Mock.ofType();
        processServiceFactory = TypeMoq.Mock.ofType();
        pythonSettings = TypeMoq.Mock.ofType();
        editorUtils = TypeMoq.Mock.ofType();
        fs = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(types_1.ICommandManager)).returns(() => commandManager.object);
        serviceContainer.setup(c => c.get(types_1.IDocumentManager)).returns(() => documentManager.object);
        serviceContainer.setup(c => c.get(types_1.IApplicationShell)).returns(() => shell.object);
        serviceContainer.setup(c => c.get(types_4.IConfigurationService)).returns(() => configurationService.object);
        serviceContainer.setup(c => c.get(types_3.IPythonExecutionFactory)).returns(() => pythonExecFactory.object);
        serviceContainer.setup(c => c.get(types_3.IProcessServiceFactory)).returns(() => processServiceFactory.object);
        serviceContainer.setup(c => c.get(types_4.IEditorUtils)).returns(() => editorUtils.object);
        serviceContainer.setup(c => c.get(types_4.IDisposableRegistry)).returns(() => []);
        serviceContainer.setup(c => c.get(types_2.IFileSystem)).returns(() => fs.object);
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        sortProvider = new importSortProvider_1.SortImportsEditingProvider(serviceContainer.object);
    });
    test('Ensure command is registered', () => {
        commandManager
            .setup(c => c.registerCommand(TypeMoq.It.isValue(constants_1.Commands.Sort_Imports), TypeMoq.It.isAny(), TypeMoq.It.isValue(sortProvider)))
            .verifiable(TypeMoq.Times.once());
        sortProvider.registerCommands();
        commandManager.verifyAll();
    });
    test('Ensure message is displayed when no doc is opened and uri isn\'t provided', () => __awaiter(this, void 0, void 0, function* () {
        documentManager
            .setup(d => d.activeTextEditor).returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isValue('Please open a Python file to sort the imports.')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        yield sortProvider.sortImports();
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure message is displayed when uri isn\'t provided and current doc is non-python', () => __awaiter(this, void 0, void 0, function* () {
        const mockEditor = TypeMoq.Mock.ofType();
        const mockDoc = TypeMoq.Mock.ofType();
        mockDoc.setup(d => d.languageId)
            .returns(() => 'xyz')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockEditor.setup(d => d.document)
            .returns(() => mockDoc.object)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.activeTextEditor)
            .returns(() => mockEditor.object)
            .verifiable(TypeMoq.Times.once());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isValue('Please open a Python file to sort the imports.')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        yield sortProvider.sortImports();
        mockEditor.verifyAll();
        mockDoc.verifyAll();
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure document is opened', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file('TestDoc');
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.activeTextEditor)
            .verifiable(TypeMoq.Times.never());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        yield sortProvider.sortImports(uri).catch(misc_1.noop);
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure no edits are provided when there is only one line', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType();
        // tslint:disable-next-line:no-any
        mockDoc.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup(d => d.lineCount)
            .returns(() => 1)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = yield sortProvider.sortImports(uri);
        chai_1.expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure no edits are provided when there are no lines', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType();
        // tslint:disable-next-line:no-any
        mockDoc.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup(d => d.lineCount)
            .returns(() => 0)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = yield sortProvider.sortImports(uri);
        chai_1.expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure empty line is added when line does not end with an empty line', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType();
        mockDoc.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup(d => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const lastLine = TypeMoq.Mock.ofType();
        let editApplied;
        lastLine.setup(l => l.text)
            .returns(() => '1234')
            .verifiable(TypeMoq.Times.atLeastOnce());
        lastLine.setup(l => l.range)
            .returns(() => new vscode_1.Range(1, 0, 10, 1))
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc.setup(d => d.lineAt(TypeMoq.It.isValue(9)))
            .returns(() => lastLine.object)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.applyEdit(TypeMoq.It.isAny()))
            .callback(e => editApplied = e)
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        sortProvider.provideDocumentSortImportsEdits = () => Promise.resolve(undefined);
        yield sortProvider.sortImports(uri);
        chai_1.expect(editApplied).not.to.be.equal(undefined, 'Applied edit is undefined');
        chai_1.expect(editApplied.entries()).to.be.lengthOf(1);
        chai_1.expect(editApplied.entries()[0][1]).to.be.lengthOf(1);
        chai_1.expect(editApplied.entries()[0][1][0].newText).to.be.equal(os_1.EOL);
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure no edits are provided when there is only one line (when using provider method)', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType();
        mockDoc.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup(d => d.lineCount)
            .returns(() => 1)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = yield sortProvider.provideDocumentSortImportsEdits(uri);
        chai_1.expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure no edits are provided when there are no lines (when using provider method)', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file('TestDoc');
        const mockDoc = TypeMoq.Mock.ofType();
        mockDoc.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup(d => d.lineCount)
            .returns(() => 0)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        shell
            .setup(s => s.showErrorMessage(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.never());
        const edit = yield sortProvider.provideDocumentSortImportsEdits(uri);
        chai_1.expect(edit).to.be.equal(undefined, 'not undefined');
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure temporary file is created for sorting when document is dirty', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file('something.py');
        const mockDoc = TypeMoq.Mock.ofType();
        let tmpFileDisposed = false;
        const tmpFile = { filePath: 'TmpFile', dispose: () => tmpFileDisposed = true };
        const processService = TypeMoq.Mock.ofType();
        processService.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup(d => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc.setup(d => d.getText(TypeMoq.It.isAny()))
            .returns(() => 'Hello')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc.setup(d => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc.setup(d => d.uri)
            .returns(() => uri)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        fs.setup(f => f.createTemporaryFile(TypeMoq.It.isValue('.py')))
            .returns(() => Promise.resolve(tmpFile))
            .verifiable(TypeMoq.Times.once());
        fs.setup(f => f.writeFile(TypeMoq.It.isValue(tmpFile.filePath), TypeMoq.It.isValue('Hello')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        pythonSettings.setup(s => s.sortImports)
            .returns(() => { return { path: 'CUSTOM_ISORT', args: ['1', '2'] }; })
            .verifiable(TypeMoq.Times.once());
        processServiceFactory.setup(p => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object))
            .verifiable(TypeMoq.Times.once());
        const expectedArgs = [tmpFile.filePath, '--diff', '1', '2'];
        processService
            .setup(p => p.exec(TypeMoq.It.isValue('CUSTOM_ISORT'), TypeMoq.It.isValue(expectedArgs), TypeMoq.It.isValue({ throwOnStdErr: true, token: undefined })))
            .returns(() => Promise.resolve({ stdout: 'DIFF' }))
            .verifiable(TypeMoq.Times.once());
        const expectedEdit = new vscode_1.WorkspaceEdit();
        editorUtils
            .setup(e => e.getWorkspaceEditsFromPatch(TypeMoq.It.isValue('Hello'), TypeMoq.It.isValue('DIFF'), TypeMoq.It.isAny()))
            .returns(() => expectedEdit)
            .verifiable(TypeMoq.Times.once());
        const edit = yield sortProvider.provideDocumentSortImportsEdits(uri);
        chai_1.expect(edit).to.be.equal(expectedEdit);
        chai_1.expect(tmpFileDisposed).to.be.equal(true, 'Temporary file not disposed');
        shell.verifyAll();
        documentManager.verifyAll();
    }));
    test('Ensure temporary file is created for sorting when document is dirty (with custom isort path)', () => __awaiter(this, void 0, void 0, function* () {
        const uri = vscode_1.Uri.file('something.py');
        const mockDoc = TypeMoq.Mock.ofType();
        let tmpFileDisposed = false;
        const tmpFile = { filePath: 'TmpFile', dispose: () => tmpFileDisposed = true };
        const processService = TypeMoq.Mock.ofType();
        processService.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup((d) => d.then).returns(() => undefined);
        mockDoc.setup(d => d.lineCount)
            .returns(() => 10)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc.setup(d => d.getText(TypeMoq.It.isAny()))
            .returns(() => 'Hello')
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc.setup(d => d.isDirty)
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());
        mockDoc.setup(d => d.uri)
            .returns(() => uri)
            .verifiable(TypeMoq.Times.atLeastOnce());
        documentManager
            .setup(d => d.openTextDocument(TypeMoq.It.isValue(uri)))
            .returns(() => Promise.resolve(mockDoc.object))
            .verifiable(TypeMoq.Times.atLeastOnce());
        fs.setup(f => f.createTemporaryFile(TypeMoq.It.isValue('.py')))
            .returns(() => Promise.resolve(tmpFile))
            .verifiable(TypeMoq.Times.once());
        fs.setup(f => f.writeFile(TypeMoq.It.isValue(tmpFile.filePath), TypeMoq.It.isValue('Hello')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        pythonSettings.setup(s => s.sortImports)
            .returns(() => { return { args: ['1', '2'] }; })
            .verifiable(TypeMoq.Times.once());
        const processExeService = TypeMoq.Mock.ofType();
        processExeService.setup((p) => p.then).returns(() => undefined);
        pythonExecFactory.setup(p => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processExeService.object))
            .verifiable(TypeMoq.Times.once());
        const importScript = path.join(constants_1.EXTENSION_ROOT_DIR, 'pythonFiles', 'sortImports.py');
        const expectedArgs = [importScript, tmpFile.filePath, '--diff', '1', '2'];
        processExeService
            .setup(p => p.exec(TypeMoq.It.isValue(expectedArgs), TypeMoq.It.isValue({ throwOnStdErr: true, token: undefined })))
            .returns(() => Promise.resolve({ stdout: 'DIFF' }))
            .verifiable(TypeMoq.Times.once());
        const expectedEdit = new vscode_1.WorkspaceEdit();
        editorUtils
            .setup(e => e.getWorkspaceEditsFromPatch(TypeMoq.It.isValue('Hello'), TypeMoq.It.isValue('DIFF'), TypeMoq.It.isAny()))
            .returns(() => expectedEdit)
            .verifiable(TypeMoq.Times.once());
        const edit = yield sortProvider.provideDocumentSortImportsEdits(uri);
        chai_1.expect(edit).to.be.equal(expectedEdit);
        chai_1.expect(tmpFileDisposed).to.be.equal(true, 'Temporary file not disposed');
        shell.verifyAll();
        documentManager.verifyAll();
    }));
});
//# sourceMappingURL=importSortProvider.unit.test.js.map