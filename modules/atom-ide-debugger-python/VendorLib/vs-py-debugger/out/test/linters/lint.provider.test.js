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
const inversify_1 = require("inversify");
const TypeMoq = require("typemoq");
const vscode = require("vscode");
const types_1 = require("../../client/common/application/types");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/types");
const async_1 = require("../../client/common/utils/async");
const contracts_1 = require("../../client/interpreter/contracts");
const container_1 = require("../../client/ioc/container");
const serviceManager_1 = require("../../client/ioc/serviceManager");
const linterAvailability_1 = require("../../client/linters/linterAvailability");
const linterManager_1 = require("../../client/linters/linterManager");
const types_4 = require("../../client/linters/types");
const linterProvider_1 = require("../../client/providers/linterProvider");
const initialize_1 = require("../initialize");
// tslint:disable-next-line:max-func-body-length
suite('Linting - Provider', () => {
    let context;
    let interpreterService;
    let engine;
    let configService;
    let docManager;
    let settings;
    let lm;
    let serviceContainer;
    let emitter;
    let document;
    let fs;
    let appShell;
    let linterInstaller;
    let workspaceService;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        const cont = new inversify_1.Container();
        const serviceManager = new serviceManager_1.ServiceManager(cont);
        serviceContainer = new container_1.ServiceContainer(cont);
        context = TypeMoq.Mock.ofType();
        fs = TypeMoq.Mock.ofType();
        fs.setup(x => x.fileExists(TypeMoq.It.isAny())).returns(() => new Promise((resolve, reject) => resolve(true)));
        fs.setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => true);
        serviceManager.addSingletonInstance(types_2.IFileSystem, fs.object);
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
        appShell = TypeMoq.Mock.ofType();
        linterInstaller = TypeMoq.Mock.ofType();
        workspaceService = TypeMoq.Mock.ofType();
        serviceManager.addSingletonInstance(types_1.IApplicationShell, appShell.object);
        serviceManager.addSingletonInstance(types_3.IInstaller, linterInstaller.object);
        serviceManager.addSingletonInstance(types_1.IWorkspaceService, workspaceService.object);
        serviceManager.add(types_4.IAvailableLinterActivator, linterAvailability_1.AvailableLinterActivator);
        lm = new linterManager_1.LinterManager(serviceContainer, workspaceService.object);
        serviceManager.addSingletonInstance(types_4.ILinterManager, lm);
        emitter = new vscode.EventEmitter();
        document = TypeMoq.Mock.ofType();
    }));
    test('Lint on open file', () => {
        docManager.setup(x => x.onDidOpenTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('test.py'));
        document.setup(x => x.languageId).returns(() => 'python');
        // tslint:disable-next-line:no-unused-variable
        const provider = new linterProvider_1.LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        engine.verify(x => x.lintDocument(document.object, 'auto'), TypeMoq.Times.once());
    });
    test('Lint on save file', () => __awaiter(this, void 0, void 0, function* () {
        docManager.setup(x => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('test.py'));
        document.setup(x => x.languageId).returns(() => 'python');
        // tslint:disable-next-line:no-unused-variable
        const provider = new linterProvider_1.LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        engine.verify(x => x.lintDocument(document.object, 'save'), TypeMoq.Times.once());
    }));
    test('No lint on open other files', () => {
        docManager.setup(x => x.onDidOpenTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('test.cs'));
        document.setup(x => x.languageId).returns(() => 'csharp');
        // tslint:disable-next-line:no-unused-variable
        const provider = new linterProvider_1.LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        engine.verify(x => x.lintDocument(document.object, 'save'), TypeMoq.Times.never());
    });
    test('No lint on save other files', () => {
        docManager.setup(x => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('test.cs'));
        document.setup(x => x.languageId).returns(() => 'csharp');
        // tslint:disable-next-line:no-unused-variable
        const provider = new linterProvider_1.LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        engine.verify(x => x.lintDocument(document.object, 'save'), TypeMoq.Times.never());
    });
    test('Lint on change interpreters', () => {
        const e = new vscode.EventEmitter();
        interpreterService.setup(x => x.onDidChangeInterpreter).returns(() => e.event);
        // tslint:disable-next-line:no-unused-variable
        const provider = new linterProvider_1.LinterProvider(context.object, serviceContainer);
        e.fire();
        engine.verify(x => x.lintOpenPythonFiles(), TypeMoq.Times.once());
    });
    test('Lint on save pylintrc', () => __awaiter(this, void 0, void 0, function* () {
        docManager.setup(x => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('.pylintrc'));
        yield lm.setActiveLintersAsync([types_3.Product.pylint]);
        // tslint:disable-next-line:no-unused-variable
        const provider = new linterProvider_1.LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        const deferred = async_1.createDeferred();
        setTimeout(() => deferred.resolve(), 2000);
        yield deferred.promise;
        engine.verify(x => x.lintOpenPythonFiles(), TypeMoq.Times.once());
    }));
    test('Diagnostic cleared on file close', () => testClearDiagnosticsOnClose(true));
    test('Diagnostic not cleared on file opened in another tab', () => testClearDiagnosticsOnClose(false));
    function testClearDiagnosticsOnClose(closed) {
        docManager.setup(x => x.onDidCloseTextDocument).returns(() => emitter.event);
        const uri = vscode.Uri.file('test.py');
        document.setup(x => x.uri).returns(() => uri);
        document.setup(x => x.isClosed).returns(() => closed);
        docManager.setup(x => x.textDocuments).returns(() => closed ? [] : [document.object]);
        // tslint:disable-next-line:prefer-const no-unused-variable
        const provider = new linterProvider_1.LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        const timesExpected = closed ? TypeMoq.Times.once() : TypeMoq.Times.never();
        engine.verify(x => x.clearDiagnostics(TypeMoq.It.isAny()), timesExpected);
    }
});
//# sourceMappingURL=lint.provider.test.js.map