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
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const types_1 = require("../../client/common/application/types");
const constants_1 = require("../../client/common/constants");
require("../../client/common/extensions");
const types_2 = require("../../client/common/platform/types");
const types_3 = require("../../client/common/types");
const lintingEngine_1 = require("../../client/linters/lintingEngine");
const types_4 = require("../../client/linters/types");
const initialize_1 = require("../initialize");
// tslint:disable-next-line:max-func-body-length
suite('Linting - LintingEngine', () => {
    let serviceContainer;
    let lintManager;
    let settings;
    let lintSettings;
    let fileSystem;
    let lintingEngine;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        serviceContainer = TypeMoq.Mock.ofType();
        const docManager = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IDocumentManager), TypeMoq.It.isAny())).returns(() => docManager.object);
        const workspaceService = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IWorkspaceService), TypeMoq.It.isAny())).returns(() => workspaceService.object);
        fileSystem = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.IFileSystem), TypeMoq.It.isAny())).returns(() => fileSystem.object);
        lintSettings = TypeMoq.Mock.ofType();
        settings = TypeMoq.Mock.ofType();
        const configService = TypeMoq.Mock.ofType();
        configService.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        configService.setup(x => x.isTestExecution()).returns(() => true);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService), TypeMoq.It.isAny())).returns(() => configService.object);
        const outputChannel = TypeMoq.Mock.ofType();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IOutputChannel), TypeMoq.It.isValue(constants_1.STANDARD_OUTPUT_CHANNEL))).returns(() => outputChannel.object);
        lintManager = TypeMoq.Mock.ofType();
        lintManager.setup(x => x.isLintingEnabled(TypeMoq.It.isAny())).returns(() => __awaiter(this, void 0, void 0, function* () { return true; }));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.ILinterManager), TypeMoq.It.isAny())).returns(() => lintManager.object);
        lintingEngine = new lintingEngine_1.LintingEngine(serviceContainer.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_4.ILintingEngine), TypeMoq.It.isAny())).returns(() => lintingEngine);
    }));
    test('Ensure document.uri is passed into isLintingEnabled', () => {
        const doc = mockTextDocument('a.py', constants_1.PYTHON_LANGUAGE, true);
        try {
            lintingEngine.lintDocument(doc, 'auto').ignoreErrors();
        }
        catch (_a) {
            lintManager.verify(l => l.isLintingEnabled(TypeMoq.It.isAny(), TypeMoq.It.isValue(doc.uri)), TypeMoq.Times.once());
        }
    });
    test('Ensure document.uri is passed into createLinter', () => {
        const doc = mockTextDocument('a.py', constants_1.PYTHON_LANGUAGE, true);
        try {
            lintingEngine.lintDocument(doc, 'auto').ignoreErrors();
        }
        catch (_a) {
            lintManager.verify(l => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isValue(doc.uri)), TypeMoq.Times.atLeastOnce());
        }
    });
    test('Verify files that match ignore pattern are not linted', () => __awaiter(this, void 0, void 0, function* () {
        const doc = mockTextDocument('a1.py', constants_1.PYTHON_LANGUAGE, true, ['a*.py']);
        yield lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(l => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
    }));
    test('Ensure non-Python files are not linted', () => __awaiter(this, void 0, void 0, function* () {
        const doc = mockTextDocument('a.ts', 'typescript', true);
        yield lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(l => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
    }));
    test('Ensure files with git scheme are not linted', () => __awaiter(this, void 0, void 0, function* () {
        const doc = mockTextDocument('a1.py', constants_1.PYTHON_LANGUAGE, false, [], 'git');
        yield lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(l => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
    }));
    test('Ensure files with showModifications scheme are not linted', () => __awaiter(this, void 0, void 0, function* () {
        const doc = mockTextDocument('a1.py', constants_1.PYTHON_LANGUAGE, false, [], 'showModifications');
        yield lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(l => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
    }));
    test('Ensure files with svn scheme are not linted', () => __awaiter(this, void 0, void 0, function* () {
        const doc = mockTextDocument('a1.py', constants_1.PYTHON_LANGUAGE, false, [], 'svn');
        yield lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(l => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
    }));
    test('Ensure non-existing files are not linted', () => __awaiter(this, void 0, void 0, function* () {
        const doc = mockTextDocument('file.py', constants_1.PYTHON_LANGUAGE, false, []);
        yield lintingEngine.lintDocument(doc, 'auto');
        lintManager.verify(l => l.createLinter(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.never());
    }));
    function mockTextDocument(fileName, language, exists, ignorePattern = [], scheme) {
        fileSystem.setup(x => x.fileExists(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(exists));
        lintSettings.setup(l => l.ignorePatterns).returns(() => ignorePattern);
        settings.setup(x => x.linting).returns(() => lintSettings.object);
        const doc = TypeMoq.Mock.ofType();
        if (scheme) {
            doc.setup(d => d.uri).returns(() => vscode_1.Uri.parse(`${scheme}:${fileName}`));
        }
        else {
            doc.setup(d => d.uri).returns(() => vscode_1.Uri.file(fileName));
        }
        doc.setup(d => d.fileName).returns(() => fileName);
        doc.setup(d => d.languageId).returns(() => language);
        return doc.object;
    }
});
//# sourceMappingURL=lintengine.test.js.map