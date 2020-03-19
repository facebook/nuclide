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
const inversify_1 = require("inversify");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
require("../../client/common/extensions");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/types");
const contracts_1 = require("../../client/interpreter/contracts");
const container_1 = require("../../client/ioc/container");
const serviceManager_1 = require("../../client/ioc/serviceManager");
const bandit_1 = require("../../client/linters/bandit");
const flake8_1 = require("../../client/linters/flake8");
const linterManager_1 = require("../../client/linters/linterManager");
const mypy_1 = require("../../client/linters/mypy");
const pep8_1 = require("../../client/linters/pep8");
const prospector_1 = require("../../client/linters/prospector");
const pydocstyle_1 = require("../../client/linters/pydocstyle");
const pylama_1 = require("../../client/linters/pylama");
const pylint_1 = require("../../client/linters/pylint");
const types_4 = require("../../client/linters/types");
const initialize_1 = require("../initialize");
suite('Linting - Arguments', () => {
    [undefined, path.join('users', 'dev_user')].forEach(workspaceUri => {
        [vscode_1.Uri.file(path.join('users', 'dev_user', 'development path to', 'one.py')), vscode_1.Uri.file(path.join('users', 'dev_user', 'development', 'one.py'))].forEach(fileUri => {
            suite(`File path ${fileUri.fsPath.indexOf(' ') > 0 ? 'with' : 'without'} spaces and ${workspaceUri ? 'without' : 'with'} a workspace`, () => {
                let interpreterService;
                let engine;
                let configService;
                let docManager;
                let settings;
                let lm;
                let serviceContainer;
                let document;
                let outputChannel;
                let workspaceService;
                const cancellationToken = new vscode_1.CancellationTokenSource().token;
                suiteSetup(initialize_1.initialize);
                setup(() => __awaiter(this, void 0, void 0, function* () {
                    const cont = new inversify_1.Container();
                    const serviceManager = new serviceManager_1.ServiceManager(cont);
                    serviceContainer = new container_1.ServiceContainer(cont);
                    outputChannel = TypeMoq.Mock.ofType();
                    const fs = TypeMoq.Mock.ofType();
                    fs.setup(x => x.fileExists(TypeMoq.It.isAny())).returns(() => new Promise((resolve, reject) => resolve(true)));
                    fs.setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => true);
                    serviceManager.addSingletonInstance(types_2.IFileSystem, fs.object);
                    serviceManager.addSingletonInstance(types_3.IOutputChannel, outputChannel.object);
                    interpreterService = TypeMoq.Mock.ofType();
                    serviceManager.addSingletonInstance(contracts_1.IInterpreterService, interpreterService.object);
                    engine = TypeMoq.Mock.ofType();
                    serviceManager.addSingletonInstance(types_4.ILintingEngine, engine.object);
                    docManager = TypeMoq.Mock.ofType();
                    serviceManager.addSingletonInstance(types_1.IDocumentManager, docManager.object);
                    const lintSettings = TypeMoq.Mock.ofType();
                    lintSettings.setup(x => x.enabled).returns(() => true);
                    lintSettings.setup(x => x.lintOnSave).returns(() => true);
                    settings = TypeMoq.Mock.ofType();
                    settings.setup(x => x.linting).returns(() => lintSettings.object);
                    configService = TypeMoq.Mock.ofType();
                    configService.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
                    serviceManager.addSingletonInstance(types_3.IConfigurationService, configService.object);
                    const workspaceFolder = workspaceUri ? { uri: vscode_1.Uri.file(workspaceUri), index: 0, name: '' } : undefined;
                    workspaceService = TypeMoq.Mock.ofType();
                    workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder);
                    serviceManager.addSingletonInstance(types_1.IWorkspaceService, workspaceService.object);
                    const logger = TypeMoq.Mock.ofType();
                    serviceManager.addSingletonInstance(types_3.ILogger, logger.object);
                    const installer = TypeMoq.Mock.ofType();
                    serviceManager.addSingletonInstance(types_3.IInstaller, installer.object);
                    const platformService = TypeMoq.Mock.ofType();
                    serviceManager.addSingletonInstance(types_2.IPlatformService, platformService.object);
                    lm = new linterManager_1.LinterManager(serviceContainer, workspaceService.object);
                    serviceManager.addSingletonInstance(types_4.ILinterManager, lm);
                    document = TypeMoq.Mock.ofType();
                }));
                function testLinter(linter, expectedArgs) {
                    return __awaiter(this, void 0, void 0, function* () {
                        document.setup(d => d.uri).returns(() => fileUri);
                        let invoked = false;
                        linter.run = (args, doc, token) => {
                            chai_1.expect(args).to.deep.equal(expectedArgs);
                            invoked = true;
                            return Promise.resolve([]);
                        };
                        yield linter.lint(document.object, cancellationToken);
                        chai_1.expect(invoked).to.be.equal(true, 'method not invoked');
                    });
                }
                test('Flake8', () => __awaiter(this, void 0, void 0, function* () {
                    const linter = new flake8_1.Flake8(outputChannel.object, serviceContainer);
                    const expectedArgs = ['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', fileUri.fsPath];
                    yield testLinter(linter, expectedArgs);
                }));
                test('Pep8', () => __awaiter(this, void 0, void 0, function* () {
                    const linter = new pep8_1.Pep8(outputChannel.object, serviceContainer);
                    const expectedArgs = ['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', fileUri.fsPath];
                    yield testLinter(linter, expectedArgs);
                }));
                test('Prospector', () => __awaiter(this, void 0, void 0, function* () {
                    const linter = new prospector_1.Prospector(outputChannel.object, serviceContainer);
                    const expectedPath = workspaceUri ? fileUri.fsPath.substring(workspaceUri.length + 2) : path.basename(fileUri.fsPath);
                    const expectedArgs = ['--absolute-paths', '--output-format=json', expectedPath];
                    yield testLinter(linter, expectedArgs);
                }));
                test('Pylama', () => __awaiter(this, void 0, void 0, function* () {
                    const linter = new pylama_1.PyLama(outputChannel.object, serviceContainer);
                    const expectedArgs = ['--format=parsable', fileUri.fsPath];
                    yield testLinter(linter, expectedArgs);
                }));
                test('MyPy', () => __awaiter(this, void 0, void 0, function* () {
                    const linter = new mypy_1.MyPy(outputChannel.object, serviceContainer);
                    const expectedArgs = [fileUri.fsPath];
                    yield testLinter(linter, expectedArgs);
                }));
                test('Pydocstyle', () => __awaiter(this, void 0, void 0, function* () {
                    const linter = new pydocstyle_1.PyDocStyle(outputChannel.object, serviceContainer);
                    const expectedArgs = [fileUri.fsPath];
                    yield testLinter(linter, expectedArgs);
                }));
                test('Pylint', () => __awaiter(this, void 0, void 0, function* () {
                    const linter = new pylint_1.Pylint(outputChannel.object, serviceContainer);
                    document.setup(d => d.uri).returns(() => fileUri);
                    let invoked = false;
                    linter.run = (args, doc, token) => {
                        chai_1.expect(args[args.length - 1]).to.equal(fileUri.fsPath);
                        invoked = true;
                        return Promise.resolve([]);
                    };
                    yield linter.lint(document.object, cancellationToken);
                    chai_1.expect(invoked).to.be.equal(true, 'method not invoked');
                }));
                test('Bandit', () => __awaiter(this, void 0, void 0, function* () {
                    const linter = new bandit_1.Bandit(outputChannel.object, serviceContainer);
                    const expectedArgs = ['-f', 'custom', '--msg-template', '{line},0,{severity},{test_id}:{msg}', '-n', '-1', fileUri.fsPath];
                    yield testLinter(linter, expectedArgs);
                }));
            });
        });
    });
});
//# sourceMappingURL=lint.args.test.js.map