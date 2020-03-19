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
const chai_1 = require("chai");
const fs = require("fs-extra");
const os_1 = require("os");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../../client/common/application/types");
const constants_1 = require("../../../client/common/constants");
require("../../../client/common/extensions");
const decoder_1 = require("../../../client/common/process/decoder");
const proc_1 = require("../../../client/common/process/proc");
const types_2 = require("../../../client/common/process/types");
const types_3 = require("../../../client/common/types");
const platform_1 = require("../../../client/common/utils/platform");
const types_4 = require("../../../client/common/variables/types");
const helper_1 = require("../../../client/terminals/codeExecution/helper");
const common_1 = require("../../common");
const TEST_FILES_PATH = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'terminalExec');
// tslint:disable-next-line:max-func-body-length
suite('Terminal - Code Execution Helper', () => {
    let documentManager;
    let applicationShell;
    let helper;
    let document;
    let editor;
    let processService;
    let configService;
    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType();
        documentManager = TypeMoq.Mock.ofType();
        applicationShell = TypeMoq.Mock.ofType();
        const envVariablesProvider = TypeMoq.Mock.ofType();
        processService = TypeMoq.Mock.ofType();
        configService = TypeMoq.Mock.ofType();
        const pythonSettings = TypeMoq.Mock.ofType();
        pythonSettings.setup(p => p.pythonPath).returns(() => common_1.PYTHON_PATH);
        // tslint:disable-next-line:no-any
        processService.setup((x) => x.then).returns(() => undefined);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        envVariablesProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));
        const processServiceFactory = TypeMoq.Mock.ofType();
        processServiceFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IProcessServiceFactory), TypeMoq.It.isAny())).returns(() => processServiceFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IDocumentManager), TypeMoq.It.isAny())).returns(() => documentManager.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IApplicationShell), TypeMoq.It.isAny())).returns(() => applicationShell.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.IEnvironmentVariablesProvider), TypeMoq.It.isAny())).returns(() => envVariablesProvider.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService), TypeMoq.It.isAny())).returns(() => configService.object);
        helper = new helper_1.CodeExecutionHelper(serviceContainer.object);
        document = TypeMoq.Mock.ofType();
        editor = TypeMoq.Mock.ofType();
        editor.setup(e => e.document).returns(() => document.object);
    });
    function ensureBlankLinesAreRemoved(source, expectedSource) {
        return __awaiter(this, void 0, void 0, function* () {
            const actualProcessService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
            processService.setup(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .returns((file, args, options) => {
                return actualProcessService.exec.apply(actualProcessService, [file, args, options]);
            });
            const normalizedZCode = yield helper.normalizeLines(source);
            // In case file has been saved with different line endings.
            expectedSource = expectedSource.splitLines({ removeEmptyEntries: false, trim: false }).join(os_1.EOL);
            chai_1.expect(normalizedZCode).to.be.equal(expectedSource);
        });
    }
    test('Ensure blank lines are NOT removed when code is not indented (simple)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // This test has not been working for many months in Python 2.7 under
            // Windows.Tracked by #2544.
            if (common_1.isOs(platform_1.OSType.Windows) && (yield common_1.isPythonVersion('2.7'))) {
                // tslint:disable-next-line:no-invalid-this
                return this.skip();
            }
            const code = ['import sys', '', '', '', 'print(sys.executable)', '', 'print("1234")', '', '', 'print(1)', 'print(2)'];
            const expectedCode = code.filter(line => line.trim().length > 0).join(os_1.EOL);
            yield ensureBlankLinesAreRemoved(code.join(os_1.EOL), expectedCode);
        });
    });
    test('Ensure there are no multiple-CR elements in the normalized code.', () => __awaiter(this, void 0, void 0, function* () {
        const code = ['import sys', '', '', '', 'print(sys.executable)', '', 'print("1234")', '', '', 'print(1)', 'print(2)'];
        const actualProcessService = new proc_1.ProcessService(new decoder_1.BufferDecoder());
        processService.setup(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((file, args, options) => {
            return actualProcessService.exec.apply(actualProcessService, [file, args, options]);
        });
        const normalizedCode = yield helper.normalizeLines(code.join(os_1.EOL));
        const doubleCrIndex = normalizedCode.indexOf('\r\r');
        chai_1.expect(doubleCrIndex).to.be.equal(-1, 'Double CR (CRCRLF) line endings detected in normalized code snippet.');
    }));
    ['', '1', '2', '3', '4', '5', '6', '7'].forEach(fileNameSuffix => {
        test(`Ensure blank lines are removed (Sample${fileNameSuffix})`, function () {
            return __awaiter(this, void 0, void 0, function* () {
                // This test has not been working for many months in Python 2.7 under
                // Windows.Tracked by #2544.
                if (common_1.isOs(platform_1.OSType.Windows) && (yield common_1.isPythonVersion('2.7'))) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
                const code = yield fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_raw.py`), 'utf8');
                const expectedCode = yield fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_normalized.py`), 'utf8');
                yield ensureBlankLinesAreRemoved(code, expectedCode);
            });
        });
        test(`Ensure last two blank lines are preserved (Sample${fileNameSuffix})`, function () {
            return __awaiter(this, void 0, void 0, function* () {
                // This test has not been working for many months in Python 2.7 under
                // Windows.Tracked by #2544.
                if (common_1.isOs(platform_1.OSType.Windows) && (yield common_1.isPythonVersion('2.7'))) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
                const code = yield fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_raw.py`), 'utf8');
                const expectedCode = yield fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_normalized.py`), 'utf8');
                yield ensureBlankLinesAreRemoved(code + os_1.EOL, expectedCode + os_1.EOL);
            });
        });
        test(`Ensure last two blank lines are preserved even if we have more than 2 trailing blank lines (Sample${fileNameSuffix})`, function () {
            return __awaiter(this, void 0, void 0, function* () {
                // This test has not been working for many months in Python 2.7 under
                // Windows.Tracked by #2544.
                if (common_1.isOs(platform_1.OSType.Windows) && (yield common_1.isPythonVersion('2.7'))) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
                const code = yield fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_raw.py`), 'utf8');
                const expectedCode = yield fs.readFile(path.join(TEST_FILES_PATH, `sample${fileNameSuffix}_normalized.py`), 'utf8');
                yield ensureBlankLinesAreRemoved(code + os_1.EOL + os_1.EOL + os_1.EOL + os_1.EOL, expectedCode + os_1.EOL);
            });
        });
    });
    test('Display message if there\s no active file', () => __awaiter(this, void 0, void 0, function* () {
        documentManager.setup(doc => doc.activeTextEditor).returns(() => undefined);
        const uri = yield helper.getFileToExecute();
        chai_1.expect(uri).to.be.an('undefined');
        applicationShell.verify(a => a.showErrorMessage(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
    }));
    test('Display message if active file is unsaved', () => __awaiter(this, void 0, void 0, function* () {
        documentManager.setup(doc => doc.activeTextEditor).returns(() => editor.object);
        document.setup(doc => doc.isUntitled).returns(() => true);
        const uri = yield helper.getFileToExecute();
        chai_1.expect(uri).to.be.an('undefined');
        applicationShell.verify(a => a.showErrorMessage(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
    }));
    test('Display message if active file is non-python', () => __awaiter(this, void 0, void 0, function* () {
        document.setup(doc => doc.isUntitled).returns(() => false);
        document.setup(doc => doc.languageId).returns(() => 'html');
        documentManager.setup(doc => doc.activeTextEditor).returns(() => editor.object);
        const uri = yield helper.getFileToExecute();
        chai_1.expect(uri).to.be.an('undefined');
        applicationShell.verify(a => a.showErrorMessage(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
    }));
    test('Returns file uri', () => __awaiter(this, void 0, void 0, function* () {
        document.setup(doc => doc.isUntitled).returns(() => false);
        document.setup(doc => doc.languageId).returns(() => constants_1.PYTHON_LANGUAGE);
        const expectedUri = vscode_1.Uri.file('one.py');
        document.setup(doc => doc.uri).returns(() => expectedUri);
        documentManager.setup(doc => doc.activeTextEditor).returns(() => editor.object);
        const uri = yield helper.getFileToExecute();
        chai_1.expect(uri).to.be.deep.equal(expectedUri);
    }));
    test('Returns file uri even if saving fails', () => __awaiter(this, void 0, void 0, function* () {
        document.setup(doc => doc.isUntitled).returns(() => false);
        document.setup(doc => doc.isDirty).returns(() => true);
        document.setup(doc => doc.languageId).returns(() => constants_1.PYTHON_LANGUAGE);
        document.setup(doc => doc.save()).returns(() => Promise.resolve(false));
        const expectedUri = vscode_1.Uri.file('one.py');
        document.setup(doc => doc.uri).returns(() => expectedUri);
        documentManager.setup(doc => doc.activeTextEditor).returns(() => editor.object);
        const uri = yield helper.getFileToExecute();
        chai_1.expect(uri).to.be.deep.equal(expectedUri);
    }));
    test('Dirty files are saved', () => __awaiter(this, void 0, void 0, function* () {
        document.setup(doc => doc.isUntitled).returns(() => false);
        document.setup(doc => doc.isDirty).returns(() => true);
        document.setup(doc => doc.languageId).returns(() => constants_1.PYTHON_LANGUAGE);
        const expectedUri = vscode_1.Uri.file('one.py');
        document.setup(doc => doc.uri).returns(() => expectedUri);
        documentManager.setup(doc => doc.activeTextEditor).returns(() => editor.object);
        const uri = yield helper.getFileToExecute();
        chai_1.expect(uri).to.be.deep.equal(expectedUri);
        document.verify(doc => doc.save(), TypeMoq.Times.once());
    }));
    test('Non-Dirty files are not-saved', () => __awaiter(this, void 0, void 0, function* () {
        document.setup(doc => doc.isUntitled).returns(() => false);
        document.setup(doc => doc.isDirty).returns(() => false);
        document.setup(doc => doc.languageId).returns(() => constants_1.PYTHON_LANGUAGE);
        const expectedUri = vscode_1.Uri.file('one.py');
        document.setup(doc => doc.uri).returns(() => expectedUri);
        documentManager.setup(doc => doc.activeTextEditor).returns(() => editor.object);
        const uri = yield helper.getFileToExecute();
        chai_1.expect(uri).to.be.deep.equal(expectedUri);
        document.verify(doc => doc.save(), TypeMoq.Times.never());
    }));
    test('Returns current line if nothing is selected', () => __awaiter(this, void 0, void 0, function* () {
        const lineContents = 'Line Contents';
        editor.setup(e => e.selection).returns(() => new vscode_1.Selection(3, 0, 3, 0));
        const textLine = TypeMoq.Mock.ofType();
        textLine.setup(t => t.text).returns(() => lineContents);
        document.setup(d => d.lineAt(TypeMoq.It.isAny())).returns(() => textLine.object);
        const content = yield helper.getSelectedTextToExecute(editor.object);
        chai_1.expect(content).to.be.equal(lineContents);
    }));
    test('Returns selected text', () => __awaiter(this, void 0, void 0, function* () {
        const lineContents = 'Line Contents';
        editor.setup(e => e.selection).returns(() => new vscode_1.Selection(3, 0, 10, 5));
        const textLine = TypeMoq.Mock.ofType();
        textLine.setup(t => t.text).returns(() => lineContents);
        document.setup(d => d.getText(TypeMoq.It.isAny())).returns((r) => `${r.start.line}.${r.start.character}.${r.end.line}.${r.end.character}`);
        const content = yield helper.getSelectedTextToExecute(editor.object);
        chai_1.expect(content).to.be.equal('3.0.10.5');
    }));
    test('saveFileIfDirty will not fail if file is not opened', () => __awaiter(this, void 0, void 0, function* () {
        documentManager.setup(d => d.textDocuments).returns(() => []).verifiable(TypeMoq.Times.once());
        yield helper.saveFileIfDirty(vscode_1.Uri.file(`${__filename}.py`));
        documentManager.verifyAll();
    }));
    test('File will be saved if file is dirty', () => __awaiter(this, void 0, void 0, function* () {
        documentManager.setup(d => d.textDocuments).returns(() => [document.object]).verifiable(TypeMoq.Times.once());
        document.setup(doc => doc.isUntitled).returns(() => false);
        document.setup(doc => doc.isDirty).returns(() => true);
        document.setup(doc => doc.languageId).returns(() => constants_1.PYTHON_LANGUAGE);
        const expectedUri = vscode_1.Uri.file('one.py');
        document.setup(doc => doc.uri).returns(() => expectedUri);
        yield helper.saveFileIfDirty(expectedUri);
        documentManager.verifyAll();
        document.verify(doc => doc.save(), TypeMoq.Times.once());
    }));
    test('File will be not saved if file is not dirty', () => __awaiter(this, void 0, void 0, function* () {
        documentManager.setup(d => d.textDocuments).returns(() => [document.object]).verifiable(TypeMoq.Times.once());
        document.setup(doc => doc.isUntitled).returns(() => false);
        document.setup(doc => doc.isDirty).returns(() => false);
        document.setup(doc => doc.languageId).returns(() => constants_1.PYTHON_LANGUAGE);
        const expectedUri = vscode_1.Uri.file('one.py');
        document.setup(doc => doc.uri).returns(() => expectedUri);
        yield helper.saveFileIfDirty(expectedUri);
        documentManager.verifyAll();
        document.verify(doc => doc.save(), TypeMoq.Times.never());
    }));
});
//# sourceMappingURL=helper.test.js.map