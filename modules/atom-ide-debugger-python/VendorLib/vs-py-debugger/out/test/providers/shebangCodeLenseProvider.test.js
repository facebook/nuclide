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
const child_process = require("child_process");
const path = require("path");
const vscode_1 = require("vscode");
const configSettings_1 = require("../../client/common/configSettings");
const shebangCodeLensProvider_1 = require("../../client/interpreter/display/shebangCodeLensProvider");
const helpers_1 = require("../../client/interpreter/helpers");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'shebang');
const fileShebang = path.join(autoCompPath, 'shebang.py');
const fileShebangEnv = path.join(autoCompPath, 'shebangEnv.py');
const fileShebangInvalid = path.join(autoCompPath, 'shebangInvalid.py');
const filePlain = path.join(autoCompPath, 'plain.py');
// tslint:disable-next-line:max-func-body-length
suite('Shebang detection', () => {
    let ioc;
    suiteSetup(initialize_1.initialize);
    suiteTeardown(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.initialize();
        yield initialize_1.closeActiveWindows();
    }));
    setup(() => __awaiter(this, void 0, void 0, function* () {
        initializeDI();
        yield initialize_1.initializeTest();
    }));
    teardown(() => ioc.dispose());
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }
    test('A code lens will appear when sheban python and python in settings are different', () => __awaiter(this, void 0, void 0, function* () {
        const pythonPath = 'someUnknownInterpreter';
        const document = yield openFile(fileShebang);
        configSettings_1.PythonSettings.getInstance(document.uri).pythonPath = pythonPath;
        const codeLenses = yield setupCodeLens(document);
        assert.equal(codeLenses.length, 1, 'No CodeLens available');
        const codeLens = codeLenses[0];
        assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
        assert.equal(codeLens.command.command, 'python.setShebangInterpreter');
    }));
    test('Code lens will not appear when sheban python and python in settings are the same', () => __awaiter(this, void 0, void 0, function* () {
        configSettings_1.PythonSettings.dispose();
        const pythonPath = yield getFullyQualifiedPathToInterpreter('python');
        const document = yield openFile(fileShebang);
        configSettings_1.PythonSettings.getInstance(document.uri).pythonPath = pythonPath;
        const codeLenses = yield setupCodeLens(document);
        assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');
    }));
    test('Code lens will not appear when sheban python is invalid', () => __awaiter(this, void 0, void 0, function* () {
        const document = yield openFile(fileShebangInvalid);
        const codeLenses = yield setupCodeLens(document);
        assert.equal(codeLenses.length, 0, 'CodeLens available even when shebang is invalid');
    }));
    if (!configSettings_1.IS_WINDOWS) {
        test('A code lens will appear when shebang python uses env and python settings are different', () => __awaiter(this, void 0, void 0, function* () {
            const document = yield openFile(fileShebangEnv);
            configSettings_1.PythonSettings.getInstance(document.uri).pythonPath = 'p1';
            const codeLenses = yield setupCodeLens(document);
            assert.equal(codeLenses.length, 1, 'No CodeLens available');
            const codeLens = codeLenses[0];
            assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
            assert.equal(codeLens.command.command, 'python.setShebangInterpreter');
        }));
        test('Code lens will not appear even when shebang python uses env and python settings are the same', () => __awaiter(this, void 0, void 0, function* () {
            const pythonPath = yield getFullyQualifiedPathToInterpreter('python');
            const document = yield openFile(fileShebangEnv);
            configSettings_1.PythonSettings.getInstance(document.uri).pythonPath = pythonPath;
            const codeLenses = yield setupCodeLens(document);
            assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');
        }));
    }
    test('Code lens will not appear as there is no shebang', () => __awaiter(this, void 0, void 0, function* () {
        const document = yield openFile(filePlain);
        const codeLenses = yield setupCodeLens(document);
        assert.equal(codeLenses.length, 0, 'CodeLens available although no shebang');
    }));
    function openFile(fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            return vscode_1.workspace.openTextDocument(fileName);
        });
    }
    function getFullyQualifiedPathToInterpreter(pythonPath) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => {
                child_process.execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_, stdout) => {
                    resolve(helpers_1.getFirstNonEmptyLineFromMultilineString(stdout));
                });
            }).catch(() => undefined);
        });
    }
    function setupCodeLens(document) {
        return __awaiter(this, void 0, void 0, function* () {
            const codeLensProvider = new shebangCodeLensProvider_1.ShebangCodeLensProvider(ioc.serviceContainer);
            return codeLensProvider.provideCodeLenses(document, new vscode_1.CancellationTokenSource().token);
        });
    }
});
//# sourceMappingURL=shebangCodeLenseProvider.test.js.map