"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
const inversify_1 = require("inversify");
const os = require("os");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/process/types");
const types_4 = require("../../client/common/types");
const container_1 = require("../../client/ioc/container");
const serviceManager_1 = require("../../client/ioc/serviceManager");
const linterManager_1 = require("../../client/linters/linterManager");
const pylint_1 = require("../../client/linters/pylint");
const types_5 = require("../../client/linters/types");
const mockClasses_1 = require("../mockClasses");
// tslint:disable-next-line:max-func-body-length
suite('Linting - Pylint', () => {
    const basePath = '/user/a/b/c/d';
    const pylintrc = 'pylintrc';
    const dotPylintrc = '.pylintrc';
    let fileSystem;
    let platformService;
    let workspace;
    let execService;
    let config;
    let serviceContainer;
    setup(() => {
        fileSystem = TypeMoq.Mock.ofType();
        fileSystem
            .setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString()))
            .returns((a, b) => a === b);
        platformService = TypeMoq.Mock.ofType();
        platformService.setup(x => x.isWindows).returns(() => false);
        workspace = TypeMoq.Mock.ofType();
        execService = TypeMoq.Mock.ofType();
        const cont = new inversify_1.Container();
        const serviceManager = new serviceManager_1.ServiceManager(cont);
        serviceContainer = new container_1.ServiceContainer(cont);
        serviceManager.addSingletonInstance(types_2.IFileSystem, fileSystem.object);
        serviceManager.addSingletonInstance(types_1.IWorkspaceService, workspace.object);
        serviceManager.addSingletonInstance(types_3.IPythonToolExecutionService, execService.object);
        serviceManager.addSingletonInstance(types_2.IPlatformService, platformService.object);
        config = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_4.IConfigurationService, config.object);
        const linterManager = new linterManager_1.LinterManager(serviceContainer, workspace.object);
        serviceManager.addSingletonInstance(types_5.ILinterManager, linterManager);
        const logger = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_4.ILogger, logger.object);
        const installer = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_4.IInstaller, installer.object);
    });
    test('pylintrc in the file folder', () => __awaiter(this, void 0, void 0, function* () {
        fileSystem.setup(x => x.fileExists(path.join(basePath, pylintrc))).returns(() => Promise.resolve(true));
        let result = yield pylint_1.Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        chai_1.expect(result).to.be.equal(true, `'${pylintrc}' not detected in the file folder.`);
        fileSystem.setup(x => x.fileExists(path.join(basePath, dotPylintrc))).returns(() => Promise.resolve(true));
        result = yield pylint_1.Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        chai_1.expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the file folder.`);
    }));
    test('pylintrc up the module tree', () => __awaiter(this, void 0, void 0, function* () {
        const module1 = path.join('/user/a/b/c/d', '__init__.py');
        const module2 = path.join('/user/a/b/c', '__init__.py');
        const module3 = path.join('/user/a/b', '__init__.py');
        const rc = path.join('/user/a/b/c', pylintrc);
        fileSystem.setup(x => x.fileExists(module1)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExists(module2)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExists(module3)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExists(rc)).returns(() => Promise.resolve(true));
        const result = yield pylint_1.Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        chai_1.expect(result).to.be.equal(true, `'${pylintrc}' not detected in the module tree.`);
    }));
    test('.pylintrc up the module tree', () => __awaiter(this, void 0, void 0, function* () {
        // Don't use path.join since it will use / on Travis and Mac
        const module1 = path.join('/user/a/b/c/d', '__init__.py');
        const module2 = path.join('/user/a/b/c', '__init__.py');
        const module3 = path.join('/user/a/b', '__init__.py');
        const rc = path.join('/user/a/b/c', pylintrc);
        fileSystem.setup(x => x.fileExists(module1)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExists(module2)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExists(module3)).returns(() => Promise.resolve(true));
        fileSystem.setup(x => x.fileExists(rc)).returns(() => Promise.resolve(true));
        const result = yield pylint_1.Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        chai_1.expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the module tree.`);
    }));
    test('.pylintrc up the ~ folder', () => __awaiter(this, void 0, void 0, function* () {
        const home = os.homedir();
        const rc = path.join(home, dotPylintrc);
        fileSystem.setup(x => x.fileExists(rc)).returns(() => Promise.resolve(true));
        const result = yield pylint_1.Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        chai_1.expect(result).to.be.equal(true, `'${dotPylintrc}' not detected in the ~ folder.`);
    }));
    test('pylintrc up the ~/.config folder', () => __awaiter(this, void 0, void 0, function* () {
        const home = os.homedir();
        const rc = path.join(home, '.config', pylintrc);
        fileSystem.setup(x => x.fileExists(rc)).returns(() => Promise.resolve(true));
        const result = yield pylint_1.Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        chai_1.expect(result).to.be.equal(true, `'${pylintrc}' not detected in the  ~/.config folder.`);
    }));
    test('pylintrc in the /etc folder', () => __awaiter(this, void 0, void 0, function* () {
        const rc = path.join('/etc', pylintrc);
        fileSystem.setup(x => x.fileExists(rc)).returns(() => Promise.resolve(true));
        const result = yield pylint_1.Pylint.hasConfigurationFile(fileSystem.object, basePath, platformService.object);
        chai_1.expect(result).to.be.equal(true, `'${pylintrc}' not detected in the /etc folder.`);
    }));
    test('pylintrc between file and workspace root', () => __awaiter(this, void 0, void 0, function* () {
        const root = '/user/a';
        const midFolder = '/user/a/b';
        fileSystem
            .setup(x => x.fileExists(path.join(midFolder, pylintrc)))
            .returns(() => Promise.resolve(true));
        const result = yield pylint_1.Pylint.hasConfigrationFileInWorkspace(fileSystem.object, basePath, root);
        chai_1.expect(result).to.be.equal(true, `'${pylintrc}' not detected in the workspace tree.`);
    }));
    test('minArgs - pylintrc between the file and the workspace root', () => __awaiter(this, void 0, void 0, function* () {
        fileSystem
            .setup(x => x.fileExists(path.join('/user/a/b', pylintrc)))
            .returns(() => Promise.resolve(true));
        yield testPylintArguments('/user/a/b/c', '/user/a', false);
    }));
    test('minArgs - no pylintrc between the file and the workspace root', () => __awaiter(this, void 0, void 0, function* () {
        yield testPylintArguments('/user/a/b/c', '/user/a', true);
    }));
    test('minArgs - pylintrc next to the file', () => __awaiter(this, void 0, void 0, function* () {
        const fileFolder = '/user/a/b/c';
        fileSystem
            .setup(x => x.fileExists(path.join(fileFolder, pylintrc)))
            .returns(() => Promise.resolve(true));
        yield testPylintArguments(fileFolder, '/user/a', false);
    }));
    test('minArgs - pylintrc at the workspace root', () => __awaiter(this, void 0, void 0, function* () {
        const root = '/user/a';
        fileSystem
            .setup(x => x.fileExists(path.join(root, pylintrc)))
            .returns(() => Promise.resolve(true));
        yield testPylintArguments('/user/a/b/c', root, false);
    }));
    function testPylintArguments(fileFolder, wsRoot, expectedMinArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            const outputChannel = TypeMoq.Mock.ofType();
            const pylinter = new pylint_1.Pylint(outputChannel.object, serviceContainer);
            const document = TypeMoq.Mock.ofType();
            document.setup(x => x.uri).returns(() => vscode_1.Uri.file(path.join(fileFolder, 'test.py')));
            const wsf = TypeMoq.Mock.ofType();
            wsf.setup(x => x.uri).returns(() => vscode_1.Uri.file(wsRoot));
            workspace.setup(x => x.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => wsf.object);
            let execInfo;
            execService
                .setup(x => x.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .callback((e, b, c) => {
                execInfo = e;
            })
                .returns(() => Promise.resolve({ stdout: '', stderr: '' }));
            const lintSettings = new mockClasses_1.MockLintingSettings();
            lintSettings.pylintUseMinimalCheckers = true;
            // tslint:disable-next-line:no-string-literal
            lintSettings['pylintPath'] = 'pyLint';
            // tslint:disable-next-line:no-string-literal
            lintSettings['pylintEnabled'] = true;
            const settings = TypeMoq.Mock.ofType();
            settings.setup(x => x.linting).returns(() => lintSettings);
            config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
            yield pylinter.lint(document.object, new vscode_1.CancellationTokenSource().token);
            chai_1.expect(execInfo.args.findIndex(x => x.indexOf('--disable=all') >= 0), 'Minimal args passed to pylint while pylintrc exists.').to.be.eq(expectedMinArgs ? 0 : -1);
        });
    }
    test('Negative column numbers should be treated 0', () => __awaiter(this, void 0, void 0, function* () {
        const fileFolder = '/user/a/b/c';
        const outputChannel = TypeMoq.Mock.ofType();
        const pylinter = new pylint_1.Pylint(outputChannel.object, serviceContainer);
        const document = TypeMoq.Mock.ofType();
        document.setup(x => x.uri).returns(() => vscode_1.Uri.file(path.join(fileFolder, 'test.py')));
        const wsf = TypeMoq.Mock.ofType();
        wsf.setup(x => x.uri).returns(() => vscode_1.Uri.file(fileFolder));
        workspace.setup(x => x.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => wsf.object);
        const linterOutput = ['No config file found, using default configuration',
            '************* Module test',
            '1,1,convention,C0111:Missing module docstring',
            '3,-1,error,E1305:Too many arguments for format string'].join(os.EOL);
        execService
            .setup(x => x.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: linterOutput, stderr: '' }));
        const lintSettings = new mockClasses_1.MockLintingSettings();
        lintSettings.pylintUseMinimalCheckers = false;
        lintSettings.maxNumberOfProblems = 1000;
        lintSettings.pylintPath = 'pyLint';
        lintSettings.pylintEnabled = true;
        lintSettings.pylintCategorySeverity = {
            convention: vscode_1.DiagnosticSeverity.Hint,
            error: vscode_1.DiagnosticSeverity.Error,
            fatal: vscode_1.DiagnosticSeverity.Error,
            refactor: vscode_1.DiagnosticSeverity.Hint,
            warning: vscode_1.DiagnosticSeverity.Warning
        };
        const settings = TypeMoq.Mock.ofType();
        settings.setup(x => x.linting).returns(() => lintSettings);
        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        const messages = yield pylinter.lint(document.object, new vscode_1.CancellationTokenSource().token);
        chai_1.expect(messages).to.be.lengthOf(2);
        chai_1.expect(messages[0].column).to.be.equal(1);
        chai_1.expect(messages[1].column).to.be.equal(0);
    }));
});
//# sourceMappingURL=pylint.test.js.map