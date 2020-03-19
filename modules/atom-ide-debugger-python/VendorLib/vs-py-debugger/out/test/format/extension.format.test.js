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
const fs = require("fs-extra");
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/process/types");
const autoPep8Formatter_1 = require("../../client/formatters/autoPep8Formatter");
const blackFormatter_1 = require("../../client/formatters/blackFormatter");
const yapfFormatter_1 = require("../../client/formatters/yapfFormatter");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const textUtils_1 = require("../textUtils");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const ch = vscode_1.window.createOutputChannel('Tests');
const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const workspaceRootPath = path.join(__dirname, '..', '..', '..', 'src', 'test');
const originalUnformattedFile = path.join(formatFilesPath, 'fileToFormat.py');
const autoPep8FileToFormat = path.join(formatFilesPath, 'autoPep8FileToFormat.py');
const blackFileToFormat = path.join(formatFilesPath, 'blackFileToFormat.py');
const blackReferenceFile = path.join(formatFilesPath, 'blackFileReference.py');
const yapfFileToFormat = path.join(formatFilesPath, 'yapfFileToFormat.py');
let formattedYapf = '';
let formattedBlack = '';
let formattedAutoPep8 = '';
// tslint:disable-next-line:max-func-body-length
suite('Formatting - General', () => {
    let ioc;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initialize();
        initializeDI();
        [autoPep8FileToFormat, blackFileToFormat, blackReferenceFile, yapfFileToFormat].forEach(file => {
            fs.copySync(originalUnformattedFile, file, { overwrite: true });
        });
        fs.ensureDirSync(path.dirname(autoPep8FileToFormat));
        const pythonProcess = yield ioc.serviceContainer.get(types_1.IPythonExecutionFactory).create({ resource: vscode_1.Uri.file(workspaceRootPath) });
        const yapf = pythonProcess.execModule('yapf', [originalUnformattedFile], { cwd: workspaceRootPath });
        const autoPep8 = pythonProcess.execModule('autopep8', [originalUnformattedFile], { cwd: workspaceRootPath });
        const formatters = [yapf, autoPep8];
        if (yield formattingTestIsBlackSupported()) {
            // Black doesn't support emitting only to stdout; it either works
            // through a pipe, emits a diff, or rewrites the file in-place.
            // Thus it's easier to let it do its in-place rewrite and then
            // read the reference file from there.
            const black = pythonProcess.execModule('black', [blackReferenceFile], { cwd: workspaceRootPath });
            formatters.push(black);
        }
        yield Promise.all(formatters).then((formattedResults) => __awaiter(this, void 0, void 0, function* () {
            formattedYapf = formattedResults[0].stdout;
            formattedAutoPep8 = formattedResults[1].stdout;
            if (yield formattingTestIsBlackSupported()) {
                formattedBlack = fs.readFileSync(blackReferenceFile).toString();
            }
        }));
    }));
    function formattingTestIsBlackSupported() {
        return __awaiter(this, void 0, void 0, function* () {
            const processService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory)
                .create(vscode_1.Uri.file(workspaceRootPath));
            return !(yield common_1.isPythonVersionInProcess(processService, '2', '3.0', '3.1', '3.2', '3.3', '3.4', '3.5'));
        });
    }
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initializeTest();
        initializeDI();
    }));
    suiteTeardown(() => __awaiter(this, void 0, void 0, function* () {
        [autoPep8FileToFormat, blackFileToFormat, blackReferenceFile, yapfFileToFormat].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        ch.dispose();
        yield initialize_1.closeActiveWindows();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerUnitTestTypes();
        ioc.registerFormatterTypes();
        // Mocks.
        ioc.registerMockProcessTypes();
    }
    function injectFormatOutput(outputFileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const procService = yield ioc.serviceContainer.get(types_1.IProcessServiceFactory).create();
            procService.onExecObservable((file, args, options, callback) => {
                if (args.indexOf('--diff') >= 0) {
                    callback({
                        out: fs.readFileSync(path.join(formatFilesPath, outputFileName), 'utf8'),
                        source: 'stdout'
                    });
                }
            });
        });
    }
    function testFormatting(formatter, formattedContents, fileToFormat, outputFileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const textDocument = yield vscode_1.workspace.openTextDocument(fileToFormat);
            const textEditor = yield vscode_1.window.showTextDocument(textDocument);
            const options = { insertSpaces: textEditor.options.insertSpaces, tabSize: textEditor.options.tabSize };
            yield injectFormatOutput(outputFileName);
            const edits = yield formatter.formatDocument(textDocument, options, new vscode_1.CancellationTokenSource().token);
            yield textEditor.edit(editBuilder => {
                edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
            });
            textUtils_1.compareFiles(formattedContents, textEditor.document.getText());
        });
    }
    test('AutoPep8', () => __awaiter(this, void 0, void 0, function* () {
        yield testFormatting(new autoPep8Formatter_1.AutoPep8Formatter(ioc.serviceContainer), formattedAutoPep8, autoPep8FileToFormat, 'autopep8.output');
    }));
    // tslint:disable-next-line:no-function-expression
    test('Black', function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield formattingTestIsBlackSupported())) {
                // Skip for versions of python below 3.6, as Black doesn't support them at all.
                // tslint:disable-next-line:no-invalid-this
                return this.skip();
            }
            yield testFormatting(new blackFormatter_1.BlackFormatter(ioc.serviceContainer), formattedBlack, blackFileToFormat, 'black.output');
        });
    });
    test('Yapf', () => __awaiter(this, void 0, void 0, function* () { return testFormatting(new yapfFormatter_1.YapfFormatter(ioc.serviceContainer), formattedYapf, yapfFileToFormat, 'yapf.output'); }));
    test('Yapf on dirty file', () => __awaiter(this, void 0, void 0, function* () {
        const sourceDir = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
        const targetDir = path.join(__dirname, '..', 'pythonFiles', 'formatting');
        const originalName = 'formatWhenDirty.py';
        const resultsName = 'formatWhenDirtyResult.py';
        const fileToFormat = path.join(targetDir, originalName);
        const formattedFile = path.join(targetDir, resultsName);
        if (!fs.pathExistsSync(targetDir)) {
            fs.mkdirpSync(targetDir);
        }
        fs.copySync(path.join(sourceDir, originalName), fileToFormat, { overwrite: true });
        fs.copySync(path.join(sourceDir, resultsName), formattedFile, { overwrite: true });
        const textDocument = yield vscode_1.workspace.openTextDocument(fileToFormat);
        const textEditor = yield vscode_1.window.showTextDocument(textDocument);
        yield textEditor.edit(builder => {
            // Make file dirty. Trailing blanks will be removed.
            builder.insert(new vscode_1.Position(0, 0), '\n    \n');
        });
        const dir = path.dirname(fileToFormat);
        const configFile = path.join(dir, '.style.yapf');
        try {
            // Create yapf configuration file
            const content = '[style]\nbased_on_style = pep8\nindent_width=5\n';
            fs.writeFileSync(configFile, content);
            const options = { insertSpaces: textEditor.options.insertSpaces, tabSize: 1 };
            const formatter = new yapfFormatter_1.YapfFormatter(ioc.serviceContainer);
            const edits = yield formatter.formatDocument(textDocument, options, new vscode_1.CancellationTokenSource().token);
            yield textEditor.edit(editBuilder => {
                edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
            });
            const expected = fs.readFileSync(formattedFile).toString();
            const actual = textEditor.document.getText();
            textUtils_1.compareFiles(expected, actual);
        }
        finally {
            if (fs.existsSync(configFile)) {
                fs.unlinkSync(configFile);
            }
        }
    }));
});
//# sourceMappingURL=extension.format.test.js.map