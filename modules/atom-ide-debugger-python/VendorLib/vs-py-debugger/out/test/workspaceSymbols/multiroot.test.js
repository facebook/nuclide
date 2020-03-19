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
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/process/types");
const generator_1 = require("../../client/workspaceSymbols/generator");
const provider_1 = require("../../client/workspaceSymbols/provider");
const initialize_1 = require("../initialize");
const mockClasses_1 = require("../mockClasses");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const common_1 = require("./../common");
const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');
suite('Multiroot Workspace Symbols', () => {
    let ioc;
    let processServiceFactory;
    suiteSetup(function () {
        if (!initialize_1.IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        return initialize_1.initialize();
    });
    setup(() => __awaiter(this, void 0, void 0, function* () {
        initializeDI();
        yield initialize_1.initializeTest();
    }));
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield initialize_1.closeActiveWindows();
        yield common_1.updateSetting('workspaceSymbols.enabled', false, vscode_1.Uri.file(path.join(multirootPath, 'parent', 'child')), vscode_1.ConfigurationTarget.WorkspaceFolder);
        yield common_1.updateSetting('workspaceSymbols.enabled', false, vscode_1.Uri.file(path.join(multirootPath, 'workspace2')), vscode_1.ConfigurationTarget.WorkspaceFolder);
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        processServiceFactory = ioc.serviceContainer.get(types_3.IProcessServiceFactory);
    }
    test('symbols should be returned when enabeld and vice versa', () => __awaiter(this, void 0, void 0, function* () {
        const childWorkspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'parent', 'child'));
        const outputChannel = new mockClasses_1.MockOutputChannel('Output');
        yield common_1.updateSetting('workspaceSymbols.enabled', false, childWorkspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder);
        let generator = new generator_1.Generator(childWorkspaceUri, outputChannel, processServiceFactory);
        let provider = new provider_1.WorkspaceSymbolProvider(ioc.serviceContainer.get(types_2.IFileSystem), ioc.serviceContainer.get(types_1.ICommandManager), [generator]);
        let symbols = yield provider.provideWorkspaceSymbols('', new vscode_1.CancellationTokenSource().token);
        assert.equal(symbols.length, 0, 'Symbols returned even when workspace symbols are turned off');
        generator.dispose();
        yield common_1.updateSetting('workspaceSymbols.enabled', true, childWorkspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder);
        generator = new generator_1.Generator(childWorkspaceUri, outputChannel, processServiceFactory);
        provider = new provider_1.WorkspaceSymbolProvider(ioc.serviceContainer.get(types_2.IFileSystem), ioc.serviceContainer.get(types_1.ICommandManager), [generator]);
        symbols = yield provider.provideWorkspaceSymbols('', new vscode_1.CancellationTokenSource().token);
        assert.notEqual(symbols.length, 0, 'Symbols should be returned when workspace symbols are turned on');
    }));
    test('symbols should be filtered correctly', () => __awaiter(this, void 0, void 0, function* () {
        const childWorkspaceUri = vscode_1.Uri.file(path.join(multirootPath, 'parent', 'child'));
        const workspace2Uri = vscode_1.Uri.file(path.join(multirootPath, 'workspace2'));
        const outputChannel = new mockClasses_1.MockOutputChannel('Output');
        yield common_1.updateSetting('workspaceSymbols.enabled', true, childWorkspaceUri, vscode_1.ConfigurationTarget.WorkspaceFolder);
        yield common_1.updateSetting('workspaceSymbols.enabled', true, workspace2Uri, vscode_1.ConfigurationTarget.WorkspaceFolder);
        const generators = [
            new generator_1.Generator(childWorkspaceUri, outputChannel, processServiceFactory),
            new generator_1.Generator(workspace2Uri, outputChannel, processServiceFactory)
        ];
        const provider = new provider_1.WorkspaceSymbolProvider(ioc.serviceContainer.get(types_2.IFileSystem), ioc.serviceContainer.get(types_1.ICommandManager), generators);
        const symbols = yield provider.provideWorkspaceSymbols('meth1Of', new vscode_1.CancellationTokenSource().token);
        assert.equal(symbols.length, 2, 'Incorrect number of symbols returned');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'File with symbol not found in child workspace folder');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'File with symbol not found in child workspace folder');
    }));
});
//# sourceMappingURL=multiroot.test.js.map