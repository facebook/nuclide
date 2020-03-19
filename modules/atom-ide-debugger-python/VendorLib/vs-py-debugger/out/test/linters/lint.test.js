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
const assert = require("assert");
const fs = require("fs-extra");
const path = require("path");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const workspace_1 = require("../../client/common/application/workspace");
const constants_1 = require("../../client/common/constants");
const productInstaller_1 = require("../../client/common/installer/productInstaller");
const productPath_1 = require("../../client/common/installer/productPath");
const productService_1 = require("../../client/common/installer/productService");
const types_2 = require("../../client/common/installer/types");
const types_3 = require("../../client/common/types");
const linterManager_1 = require("../../client/linters/linterManager");
const types_4 = require("../../client/linters/types");
const common_1 = require("../common");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const workspaceUri = vscode_1.Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
const pythoFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'linting');
const flake8ConfigPath = path.join(pythoFilesPath, 'flake8config');
const pep8ConfigPath = path.join(pythoFilesPath, 'pep8config');
const pydocstyleConfigPath27 = path.join(pythoFilesPath, 'pydocstyleconfig27');
const pylintConfigPath = path.join(pythoFilesPath, 'pylintconfig');
const fileToLint = path.join(pythoFilesPath, 'file.py');
const threeLineLintsPath = path.join(pythoFilesPath, 'threeLineLints.py');
const pylintMessagesToBeReturned = [
    { line: 24, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 30, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 34, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 40, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 44, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 55, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 59, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0012', message: 'Locally enabling no-member (E1101)', provider: '', type: '' },
    { line: 62, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling undefined-variable (E0602)', provider: '', type: '' },
    { line: 70, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 84, column: 0, severity: types_4.LintMessageSeverity.Information, code: 'I0011', message: 'Locally disabling no-member (E1101)', provider: '', type: '' },
    { line: 87, column: 0, severity: types_4.LintMessageSeverity.Hint, code: 'C0304', message: 'Final newline missing', provider: '', type: '' },
    { line: 11, column: 20, severity: types_4.LintMessageSeverity.Warning, code: 'W0613', message: 'Unused argument \'arg\'', provider: '', type: '' },
    { line: 26, column: 14, severity: types_4.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blop\' member', provider: '', type: '' },
    { line: 36, column: 14, severity: types_4.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 46, column: 18, severity: types_4.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 61, column: 18, severity: types_4.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 72, column: 18, severity: types_4.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 75, column: 18, severity: types_4.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 77, column: 14, severity: types_4.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' },
    { line: 83, column: 14, severity: types_4.LintMessageSeverity.Error, code: 'E1101', message: 'Instance of \'Foo\' has no \'blip\' member', provider: '', type: '' }
];
const flake8MessagesToBeReturned = [
    { line: 5, column: 1, severity: types_4.LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: types_4.LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: types_4.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: types_4.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: types_4.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: types_4.LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: types_4.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const pep8MessagesToBeReturned = [
    { line: 5, column: 1, severity: types_4.LintMessageSeverity.Error, code: 'E302', message: 'expected 2 blank lines, found 1', provider: '', type: '' },
    { line: 19, column: 15, severity: types_4.LintMessageSeverity.Error, code: 'E127', message: 'continuation line over-indented for visual indent', provider: '', type: '' },
    { line: 24, column: 23, severity: types_4.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 62, column: 30, severity: types_4.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 70, column: 22, severity: types_4.LintMessageSeverity.Error, code: 'E261', message: 'at least two spaces before inline comment', provider: '', type: '' },
    { line: 80, column: 5, severity: types_4.LintMessageSeverity.Error, code: 'E303', message: 'too many blank lines (2)', provider: '', type: '' },
    { line: 87, column: 24, severity: types_4.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const pydocstyleMessagseToBeReturned = [
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'e\')', column: 0, line: 1, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'t\')', column: 0, line: 5, type: '', provider: 'pydocstyle' },
    { code: 'D102', severity: types_4.LintMessageSeverity.Information, message: 'Missing docstring in public method', column: 4, line: 8, type: '', provider: 'pydocstyle' },
    { code: 'D401', severity: types_4.LintMessageSeverity.Information, message: 'First line should be in imperative mood (\'thi\', not \'this\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: types_4.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'This\', not \'this\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'e\')', column: 4, line: 11, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: types_4.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'And\', not \'and\')', column: 4, line: 15, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'t\')', column: 4, line: 15, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: types_4.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 21, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 21, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: types_4.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 28, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 28, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: types_4.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 38, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 38, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: types_4.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 53, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 53, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: types_4.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 68, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 68, type: '', provider: 'pydocstyle' },
    { code: 'D403', severity: types_4.LintMessageSeverity.Information, message: 'First word of the first line should be properly capitalized (\'Test\', not \'test\')', column: 4, line: 80, type: '', provider: 'pydocstyle' },
    { code: 'D400', severity: types_4.LintMessageSeverity.Information, message: 'First line should end with a period (not \'g\')', column: 4, line: 80, type: '', provider: 'pydocstyle' }
];
const filteredFlake8MessagesToBeReturned = [
    { line: 87, column: 24, severity: types_4.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
const filteredPep88MessagesToBeReturned = [
    { line: 87, column: 24, severity: types_4.LintMessageSeverity.Warning, code: 'W292', message: 'no newline at end of file', provider: '', type: '' }
];
// tslint:disable-next-line:max-func-body-length
suite('Linting - General Tests', () => {
    let ioc;
    let linterManager;
    let configService;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        initializeDI();
        yield initialize_1.initializeTest();
        yield resetSettings();
    }));
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield initialize_1.closeActiveWindows();
        yield resetSettings();
        yield common_1.deleteFile(path.join(workspaceUri.fsPath, '.pylintrc'));
        yield common_1.deleteFile(path.join(workspaceUri.fsPath, '.pydocstyle'));
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerPlatformTypes();
        linterManager = new linterManager_1.LinterManager(ioc.serviceContainer, new workspace_1.WorkspaceService());
        configService = ioc.serviceContainer.get(types_3.IConfigurationService);
        ioc.serviceManager.addSingletonInstance(types_2.IProductService, new productService_1.ProductService());
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.CTagsProductPathService, types_3.ProductType.WorkspaceSymbols);
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.FormatterProductPathService, types_3.ProductType.Formatter);
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.LinterProductPathService, types_3.ProductType.Linter);
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.TestFrameworkProductPathService, types_3.ProductType.TestFramework);
        ioc.serviceManager.addSingleton(types_2.IProductPathService, productPath_1.RefactoringLibraryProductPathService, types_3.ProductType.RefactoringLibrary);
    }
    function resetSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            // Don't run these updates in parallel, as they are updating the same file.
            const target = initialize_1.IS_MULTI_ROOT_TEST ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Workspace;
            yield configService.updateSetting('linting.enabled', true, common_1.rootWorkspaceUri, target);
            yield configService.updateSetting('linting.lintOnSave', false, common_1.rootWorkspaceUri, target);
            yield configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);
            linterManager.getAllLinterInfos().forEach((x) => __awaiter(this, void 0, void 0, function* () {
                yield configService.updateSetting(makeSettingKey(x.product), false, common_1.rootWorkspaceUri, target);
            }));
        });
    }
    function makeSettingKey(product) {
        return `linting.${linterManager.getLinterInfo(product).enabledSettingName}`;
    }
    function testEnablingDisablingOfLinter(product, enabled, file) {
        return __awaiter(this, void 0, void 0, function* () {
            const setting = makeSettingKey(product);
            const output = ioc.serviceContainer.get(types_3.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
            yield configService.updateSetting(setting, enabled, common_1.rootWorkspaceUri, initialize_1.IS_MULTI_ROOT_TEST ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Workspace);
            file = file ? file : fileToLint;
            const document = yield vscode_1.workspace.openTextDocument(file);
            const cancelToken = new vscode_1.CancellationTokenSource();
            yield linterManager.setActiveLintersAsync([product]);
            yield linterManager.enableLintingAsync(enabled);
            const linter = yield linterManager.createLinter(product, output, ioc.serviceContainer);
            const messages = yield linter.lint(document, cancelToken.token);
            if (enabled) {
                assert.notEqual(messages.length, 0, `No linter errors when linter is enabled, Output - ${output.output}`);
            }
            else {
                assert.equal(messages.length, 0, `Errors returned when linter is disabled, Output - ${output.output}`);
            }
        });
    }
    test('Disable Pylint and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.pylint, false);
    }));
    test('Enable Pylint and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.pylint, true);
    }));
    test('Disable Pep8 and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.pep8, false);
    }));
    test('Enable Pep8 and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.pep8, true);
    }));
    test('Disable Flake8 and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.flake8, false);
    }));
    test('Enable Flake8 and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.flake8, true);
    }));
    test('Disable Prospector and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.prospector, false);
    }));
    test('Enable Prospector and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.prospector, true);
    }));
    test('Disable Pydocstyle and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.pydocstyle, false);
    }));
    test('Enable Pydocstyle and test linter', () => __awaiter(this, void 0, void 0, function* () {
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.pydocstyle, true);
    }));
    // tslint:disable-next-line:no-any
    function testLinterMessages(product, pythonFile, messagesToBeReceived) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputChannel = ioc.serviceContainer.get(types_3.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
            const cancelToken = new vscode_1.CancellationTokenSource();
            const document = yield vscode_1.workspace.openTextDocument(pythonFile);
            yield linterManager.setActiveLintersAsync([product], document.uri);
            const linter = yield linterManager.createLinter(product, outputChannel, ioc.serviceContainer);
            const messages = yield linter.lint(document, cancelToken.token);
            if (messagesToBeReceived.length === 0) {
                assert.equal(messages.length, 0, `No errors in linter, Output - ${outputChannel.output}`);
            }
            else {
                if (outputChannel.output.indexOf('ENOENT') === -1) {
                    // Pylint for Python Version 2.7 could return 80 linter messages, where as in 3.5 it might only return 1.
                    // Looks like pylint stops linting as soon as it comes across any ERRORS.
                    assert.notEqual(messages.length, 0, `No errors in linter, Output - ${outputChannel.output}`);
                }
            }
        });
    }
    test('PyLint', () => __awaiter(this, void 0, void 0, function* () {
        yield testLinterMessages(productInstaller_1.Product.pylint, fileToLint, pylintMessagesToBeReturned);
    }));
    test('Flake8', () => __awaiter(this, void 0, void 0, function* () {
        yield testLinterMessages(productInstaller_1.Product.flake8, fileToLint, flake8MessagesToBeReturned);
    }));
    test('Pep8', () => __awaiter(this, void 0, void 0, function* () {
        yield testLinterMessages(productInstaller_1.Product.pep8, fileToLint, pep8MessagesToBeReturned);
    }));
    test('Pydocstyle', () => __awaiter(this, void 0, void 0, function* () {
        yield testLinterMessages(productInstaller_1.Product.pydocstyle, fileToLint, pydocstyleMessagseToBeReturned);
    }));
    test('PyLint with config in root', () => __awaiter(this, void 0, void 0, function* () {
        yield fs.copy(path.join(pylintConfigPath, '.pylintrc'), path.join(workspaceUri.fsPath, '.pylintrc'));
        yield testLinterMessages(productInstaller_1.Product.pylint, path.join(pylintConfigPath, 'file2.py'), []);
    }));
    test('Flake8 with config in root', () => __awaiter(this, void 0, void 0, function* () {
        yield testLinterMessages(productInstaller_1.Product.flake8, path.join(flake8ConfigPath, 'file.py'), filteredFlake8MessagesToBeReturned);
    }));
    test('Pep8 with config in root', () => __awaiter(this, void 0, void 0, function* () {
        yield testLinterMessages(productInstaller_1.Product.pep8, path.join(pep8ConfigPath, 'file.py'), filteredPep88MessagesToBeReturned);
    }));
    test('Pydocstyle with config in root', () => __awaiter(this, void 0, void 0, function* () {
        yield configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);
        yield fs.copy(path.join(pydocstyleConfigPath27, '.pydocstyle'), path.join(workspaceUri.fsPath, '.pydocstyle'));
        yield testLinterMessages(productInstaller_1.Product.pydocstyle, path.join(pydocstyleConfigPath27, 'file.py'), []);
    }));
    test('PyLint minimal checkers', () => __awaiter(this, void 0, void 0, function* () {
        const file = path.join(pythoFilesPath, 'minCheck.py');
        yield configService.updateSetting('linting.pylintUseMinimalCheckers', true, workspaceUri);
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.pylint, false, file);
        yield configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);
        yield testEnablingDisablingOfLinter(productInstaller_1.Product.pylint, true, file);
    }));
    // tslint:disable-next-line:no-function-expression
    test('Multiple linters', function () {
        return __awaiter(this, void 0, void 0, function* () {
            //      Unreliable test being skipped until we can sort it out.  See gh-2609.
            //          - Fails about 1/3 of runs on Windows
            //          - Symptom: lintingEngine::lintOpenPythonFiles returns values *after* command await resolves in lint.tests
            //          - lintOpenPythonFiles returns 3 sets of values, not what I expect (1).
            //          - Haven't yet found a way to await on this properly.
            const skipped = true;
            if (skipped) {
                // tslint:disable-next-line:no-invalid-this
                return this.skip();
            }
            yield initialize_1.closeActiveWindows();
            const document = yield vscode_1.workspace.openTextDocument(path.join(pythoFilesPath, 'print.py'));
            yield vscode_1.window.showTextDocument(document);
            yield configService.updateSetting('linting.enabled', true, workspaceUri);
            yield configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);
            yield configService.updateSetting('linting.pylintEnabled', true, workspaceUri);
            yield configService.updateSetting('linting.flake8Enabled', true, workspaceUri);
            const commands = ioc.serviceContainer.get(types_1.ICommandManager);
            const collection = yield commands.executeCommand('python.runLinting');
            assert.notEqual(collection, undefined, 'python.runLinting did not return valid diagnostics collection.');
            const messages = collection.get(document.uri);
            assert.notEqual(messages.length, 0, 'No diagnostic messages.');
            assert.notEqual(messages.filter(x => x.source === 'pylint').length, 0, 'No pylint messages.');
            assert.notEqual(messages.filter(x => x.source === 'flake8').length, 0, 'No flake8 messages.');
        });
    });
    // tslint:disable-next-line:no-any
    function testLinterMessageCount(product, pythonFile, messageCountToBeReceived) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputChannel = ioc.serviceContainer.get(types_3.IOutputChannel, constants_1.STANDARD_OUTPUT_CHANNEL);
            const cancelToken = new vscode_1.CancellationTokenSource();
            const document = yield vscode_1.workspace.openTextDocument(pythonFile);
            yield linterManager.setActiveLintersAsync([product], document.uri);
            const linter = yield linterManager.createLinter(product, outputChannel, ioc.serviceContainer);
            const messages = yield linter.lint(document, cancelToken.token);
            assert.equal(messages.length, messageCountToBeReceived, 'Expected number of lint errors does not match lint error count');
        });
    }
    test('Three line output counted as one message', () => __awaiter(this, void 0, void 0, function* () {
        const maxErrors = 5;
        const target = initialize_1.IS_MULTI_ROOT_TEST ? vscode_1.ConfigurationTarget.WorkspaceFolder : vscode_1.ConfigurationTarget.Workspace;
        yield configService.updateSetting('linting.maxNumberOfProblems', maxErrors, common_1.rootWorkspaceUri, target);
        yield testLinterMessageCount(productInstaller_1.Product.pylint, threeLineLintsPath, maxErrors);
    }));
});
//# sourceMappingURL=lint.test.js.map