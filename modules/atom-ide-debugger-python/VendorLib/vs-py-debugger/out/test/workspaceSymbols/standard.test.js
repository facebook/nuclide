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
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const configSettings_1 = require("../../client/common/configSettings");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/process/types");
const generator_1 = require("../../client/workspaceSymbols/generator");
const provider_1 = require("../../client/workspaceSymbols/provider");
const initialize_1 = require("../initialize");
const mockClasses_1 = require("../mockClasses");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const common_1 = require("./../common");
const workspaceUri = vscode_1.Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
const configUpdateTarget = initialize_1.IS_MULTI_ROOT_TEST ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Workspace;
suite('Workspace Symbols', () => {
    let ioc;
    let processServiceFactory;
    suiteSetup(initialize_1.initialize);
    suiteTeardown(initialize_1.closeActiveWindows);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        initializeDI();
        yield initialize_1.initializeTest();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield initialize_1.closeActiveWindows();
        yield common_1.updateSetting('workspaceSymbols.enabled', false, workspaceUri, configUpdateTarget);
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        processServiceFactory = ioc.serviceContainer.get(types_3.IProcessServiceFactory);
    }
    test('symbols should be returned when enabeld and vice versa', () => __awaiter(this, void 0, void 0, function* () {
        const outputChannel = new mockClasses_1.MockOutputChannel('Output');
        yield common_1.updateSetting('workspaceSymbols.enabled', false, workspaceUri, configUpdateTarget);
        // The workspace will be in the output test folder
        // So lets modify the settings so it sees the source test folder
        let settings = configSettings_1.PythonSettings.getInstance(workspaceUri);
        settings.workspaceSymbols.tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags');
        let generator = new generator_1.Generator(workspaceUri, outputChannel, processServiceFactory);
        let provider = new provider_1.WorkspaceSymbolProvider(ioc.serviceContainer.get(types_2.IFileSystem), ioc.serviceContainer.get(types_1.ICommandManager), [generator]);
        let symbols = yield provider.provideWorkspaceSymbols('', new vscode_1.CancellationTokenSource().token);
        assert.equal(symbols.length, 0, 'Symbols returned even when workspace symbols are turned off');
        generator.dispose();
        yield common_1.updateSetting('workspaceSymbols.enabled', true, workspaceUri, configUpdateTarget);
        // The workspace will be in the output test folder
        // So lets modify the settings so it sees the source test folder
        settings = configSettings_1.PythonSettings.getInstance(workspaceUri);
        settings.workspaceSymbols.tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags');
        generator = new generator_1.Generator(workspaceUri, outputChannel, processServiceFactory);
        provider = new provider_1.WorkspaceSymbolProvider(ioc.serviceContainer.get(types_2.IFileSystem), ioc.serviceContainer.get(types_1.ICommandManager), [generator]);
        symbols = yield provider.provideWorkspaceSymbols('', new vscode_1.CancellationTokenSource().token);
        assert.notEqual(symbols.length, 0, 'Symbols should be returned when workspace symbols are turned on');
    }));
    test('symbols should be filtered correctly', () => __awaiter(this, void 0, void 0, function* () {
        const outputChannel = new mockClasses_1.MockOutputChannel('Output');
        yield common_1.updateSetting('workspaceSymbols.enabled', true, workspaceUri, configUpdateTarget);
        // The workspace will be in the output test folder
        // So lets modify the settings so it sees the source test folder
        const settings = configSettings_1.PythonSettings.getInstance(workspaceUri);
        settings.workspaceSymbols.tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags');
        const generators = [new generator_1.Generator(workspaceUri, outputChannel, processServiceFactory)];
        const provider = new provider_1.WorkspaceSymbolProvider(ioc.serviceContainer.get(types_2.IFileSystem), ioc.serviceContainer.get(types_1.ICommandManager), generators);
        const symbols = yield provider.provideWorkspaceSymbols('meth1Of', new vscode_1.CancellationTokenSource().token);
        assert.equal(symbols.length >= 2, true, 'Incorrect number of symbols returned');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'File with symbol not found in child workspace folder');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'File with symbol not found in child workspace folder');
        const symbolsForMeth = yield provider.provideWorkspaceSymbols('meth', new vscode_1.CancellationTokenSource().token);
        assert.equal(symbolsForMeth.length >= 10, true, 'Incorrect number of symbols returned');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'Symbols not returned for childFile.py');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'Symbols not returned for workspace2File.py');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('file.py')), -1, 'Symbols not returned for file.py');
    }));
});
//# sourceMappingURL=standard.test.js.map