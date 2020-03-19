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
const fs = require("fs-extra");
const path = require("path");
const TypeMoq = require("typemoq");
const vscode = require("vscode");
const types_1 = require("../../client/common/application/types");
const configSettings_1 = require("../../client/common/configSettings");
const types_2 = require("../../client/common/types");
const formatProvider_1 = require("../../client/providers/formatProvider");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const formatFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
const unformattedFile = path.join(formatFilesPath, 'fileToFormat.py');
suite('Formating On Save', () => {
    let ioc;
    let config;
    let editorConfig;
    let workspace;
    let documentManager;
    let commands;
    let options;
    let listener;
    setup(initializeDI);
    suiteTeardown(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.closeActiveWindows();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        ioc.dispose();
        yield initialize_1.closeActiveWindows();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerFormatterTypes();
        ioc.registerFileSystemTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerMockProcess();
        config = TypeMoq.Mock.ofType();
        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => configSettings_1.PythonSettings.getInstance());
        editorConfig = TypeMoq.Mock.ofType();
        workspace = TypeMoq.Mock.ofType();
        workspace.setup(x => x.getConfiguration('editor', TypeMoq.It.isAny())).returns(() => editorConfig.object);
        const event = TypeMoq.Mock.ofType();
        event.setup(x => x(TypeMoq.It.isAny())).callback((s) => {
            listener = s;
            // tslint:disable-next-line:no-empty
        }).returns(() => new vscode.Disposable(() => { }));
        documentManager = TypeMoq.Mock.ofType();
        documentManager.setup(x => x.onDidSaveTextDocument).returns(() => event.object);
        options = TypeMoq.Mock.ofType();
        options.setup(x => x.insertSpaces).returns(() => true);
        options.setup(x => x.tabSize).returns(() => 4);
        commands = TypeMoq.Mock.ofType();
        commands.setup(x => x.executeCommand('editor.action.formatDocument')).returns(() => new Promise((resolve, reject) => resolve()));
        ioc.serviceManager.addSingletonInstance(types_2.IConfigurationService, config.object);
        ioc.serviceManager.addSingletonInstance(types_1.ICommandManager, commands.object);
        ioc.serviceManager.addSingletonInstance(types_1.IWorkspaceService, workspace.object);
        ioc.serviceManager.addSingletonInstance(types_1.IDocumentManager, documentManager.object);
    }
    test('Workaround VS Code 41194', () => __awaiter(this, void 0, void 0, function* () {
        editorConfig.setup(x => x.get('formatOnSave')).returns(() => true);
        const content = yield fs.readFile(unformattedFile, 'utf8');
        let version = 1;
        const document = TypeMoq.Mock.ofType();
        document.setup(x => x.getText()).returns(() => content);
        document.setup(x => x.uri).returns(() => vscode.Uri.file(unformattedFile));
        document.setup(x => x.isDirty).returns(() => false);
        document.setup(x => x.fileName).returns(() => unformattedFile);
        document.setup(x => x.save()).callback(() => version += 1);
        document.setup(x => x.version).returns(() => version);
        const context = TypeMoq.Mock.ofType();
        const provider = new formatProvider_1.PythonFormattingEditProvider(context.object, ioc.serviceContainer);
        const edits = yield provider.provideDocumentFormattingEdits(document.object, options.object, new vscode.CancellationTokenSource().token);
        chai_1.expect(edits.length).be.greaterThan(0, 'Formatter produced no edits');
        yield listener(document.object);
        yield new Promise((resolve, reject) => setTimeout(resolve, 500));
        commands.verify(x => x.executeCommand('editor.action.formatDocument'), TypeMoq.Times.once());
        document.verify(x => x.save(), TypeMoq.Times.once());
    }));
});
//# sourceMappingURL=extension.formatOnSave.test.js.map