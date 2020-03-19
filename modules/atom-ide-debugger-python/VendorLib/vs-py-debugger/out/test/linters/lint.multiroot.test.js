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
const configSettings_1 = require("../../client/common/configSettings");
const productPath_1 = require("../../client/common/installer/productPath");
const productService_1 = require("../../client/common/installer/productService");
const types_1 = require("../../client/common/installer/types");
const types_2 = require("../../client/common/types");
const types_3 = require("../../client/linters/types");
const constants_1 = require("../../client/unittests/common/constants");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
// tslint:disable:max-func-body-length no-invalid-this
const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');
suite('Multiroot Linting', () => {
    const pylintSetting = 'linting.pylintEnabled';
    const flake8Setting = 'linting.flake8Enabled';
    let ioc;
    suiteSetup(function () {
        if (!initialize_1.IS_MULTI_ROOT_TEST) {
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
        configSettings_1.PythonSettings.dispose();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerPlatformTypes();
        ioc.serviceManager.addSingletonInstance(types_1.IProductService, new productService_1.ProductService());
        ioc.serviceManager.addSingleton(types_1.IProductPathService, productPath_1.CTagsProductPathService, types_2.ProductType.WorkspaceSymbols);
        ioc.serviceManager.addSingleton(types_1.IProductPathService, productPath_1.FormatterProductPathService, types_2.ProductType.Formatter);
        ioc.serviceManager.addSingleton(types_1.IProductPathService, productPath_1.LinterProductPathService, types_2.ProductType.Linter);
        ioc.serviceManager.addSingleton(types_1.IProductPathService, productPath_1.TestFrameworkProductPathService, types_2.ProductType.TestFramework);
        ioc.serviceManager.addSingleton(types_1.IProductPathService, productPath_1.RefactoringLibraryProductPathService, types_2.ProductType.RefactoringLibrary);
    }
    function createLinter(product, resource) {
        return __awaiter(this, void 0, void 0, function* () {
            const mockOutputChannel = ioc.serviceContainer.get(types_2.IOutputChannel, constants_1.TEST_OUTPUT_CHANNEL);
            const lm = ioc.serviceContainer.get(types_3.ILinterManager);
            yield lm.setActiveLintersAsync([product], resource);
            return lm.createLinter(product, mockOutputChannel, ioc.serviceContainer);
        });
    }
    function testLinterInWorkspaceFolder(product, workspaceFolderRelativePath, mustHaveErrors) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileToLint = path.join(multirootPath, workspaceFolderRelativePath, 'file.py');
            const cancelToken = new vscode_1.CancellationTokenSource();
            const document = yield vscode_1.workspace.openTextDocument(fileToLint);
            const linter = yield createLinter(product);
            const messages = yield linter.lint(document, cancelToken.token);
            const errorMessage = mustHaveErrors ? 'No errors returned by linter' : 'Errors returned by linter';
            assert.equal(messages.length > 0, mustHaveErrors, errorMessage);
        });
    }
    function enableDisableSetting(workspaceFolder, configTarget, setting, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = ioc.serviceContainer.get(types_2.IConfigurationService);
            yield config.updateSetting(setting, value, vscode_1.Uri.file(workspaceFolder), configTarget);
        });
    }
    test('Enabling Pylint in root and also in Workspace, should return errors', () => __awaiter(this, void 0, void 0, function* () {
        yield runTest(types_2.Product.pylint, true, true, pylintSetting);
    }));
    test('Enabling Pylint in root and disabling in Workspace, should not return errors', () => __awaiter(this, void 0, void 0, function* () {
        yield runTest(types_2.Product.pylint, true, false, pylintSetting);
    }));
    test('Disabling Pylint in root and enabling in Workspace, should return errors', () => __awaiter(this, void 0, void 0, function* () {
        yield runTest(types_2.Product.pylint, false, true, pylintSetting);
    }));
    test('Enabling Flake8 in root and also in Workspace, should return errors', () => __awaiter(this, void 0, void 0, function* () {
        yield runTest(types_2.Product.flake8, true, true, flake8Setting);
    }));
    test('Enabling Flake8 in root and disabling in Workspace, should not return errors', () => __awaiter(this, void 0, void 0, function* () {
        yield runTest(types_2.Product.flake8, true, false, flake8Setting);
    }));
    test('Disabling Flake8 in root and enabling in Workspace, should return errors', () => __awaiter(this, void 0, void 0, function* () {
        yield runTest(types_2.Product.flake8, false, true, flake8Setting);
    }));
    function runTest(product, global, wks, setting) {
        return __awaiter(this, void 0, void 0, function* () {
            const expected = wks ? wks : global;
            yield enableDisableSetting(multirootPath, vscode_1.ConfigurationTarget.Global, setting, global);
            yield enableDisableSetting(multirootPath, vscode_1.ConfigurationTarget.Workspace, setting, wks);
            yield testLinterInWorkspaceFolder(product, 'workspace1', expected);
        });
    }
});
//# sourceMappingURL=lint.multiroot.test.js.map