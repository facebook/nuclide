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
const chai_1 = require("chai");
const os_1 = require("os");
const path = require("path");
const typeMoq = require("typemoq");
const vscode_1 = require("vscode");
const constants_1 = require("../../client/common/constants");
require("../../client/common/extensions");
const decoder_1 = require("../../client/common/process/decoder");
const proc_1 = require("../../client/common/process/proc");
const pythonExecutionFactory_1 = require("../../client/common/process/pythonExecutionFactory");
const types_1 = require("../../client/common/process/types");
const types_2 = require("../../client/common/types");
const proxy_1 = require("../../client/refactor/proxy");
const common_1 = require("../common");
const initialize_1 = require("./../initialize");
suite('Refactor Rename', () => {
    const options = { cursorStyle: vscode_1.TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: vscode_1.TextEditorLineNumbersStyle.Off, tabSize: 4 };
    let pythonSettings;
    let serviceContainer;
    suiteSetup(initialize_1.initialize);
    setup(() => __awaiter(this, void 0, void 0, function* () {
        pythonSettings = typeMoq.Mock.ofType();
        pythonSettings.setup(p => p.pythonPath).returns(() => common_1.PYTHON_PATH);
        const configService = typeMoq.Mock.ofType();
        configService.setup(c => c.getSettings(typeMoq.It.isAny())).returns(() => pythonSettings.object);
        const processServiceFactory = typeMoq.Mock.ofType();
        processServiceFactory.setup(p => p.create(typeMoq.It.isAny())).returns(() => Promise.resolve(new proc_1.ProcessService(new decoder_1.BufferDecoder())));
        serviceContainer = typeMoq.Mock.ofType();
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_2.IConfigurationService), typeMoq.It.isAny())).returns(() => configService.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_1.IProcessServiceFactory), typeMoq.It.isAny())).returns(() => processServiceFactory.object);
        serviceContainer.setup(s => s.get(typeMoq.It.isValue(types_1.IPythonExecutionFactory), typeMoq.It.isAny())).returns(() => new pythonExecutionFactory_1.PythonExecutionFactory(serviceContainer.object));
        yield initialize_1.initializeTest();
    }));
    teardown(initialize_1.closeActiveWindows);
    suiteTeardown(initialize_1.closeActiveWindows);
    test('Rename function in source without a trailing empty line', () => __awaiter(this, void 0, void 0, function* () {
        const sourceFile = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'refactoring', 'source folder', 'without empty line.py');
        const expectedDiff = `--- a/${path.basename(sourceFile)}${os_1.EOL}+++ b/${path.basename(sourceFile)}${os_1.EOL}@@ -1,8 +1,8 @@${os_1.EOL} import os${os_1.EOL} ${os_1.EOL}-def one():${os_1.EOL}+def three():${os_1.EOL}     return True${os_1.EOL} ${os_1.EOL} def two():${os_1.EOL}-    if one():${os_1.EOL}-        print(\"A\" + one())${os_1.EOL}+    if three():${os_1.EOL}+        print(\"A\" + three())${os_1.EOL}`
            .splitLines({ removeEmptyEntries: false, trim: false });
        const proxy = new proxy_1.RefactorProxy(constants_1.EXTENSION_ROOT_DIR, pythonSettings.object, path.dirname(sourceFile), serviceContainer.object);
        const textDocument = yield vscode_1.workspace.openTextDocument(sourceFile);
        yield vscode_1.window.showTextDocument(textDocument);
        const response = yield proxy.rename(textDocument, 'three', sourceFile, new vscode_1.Range(7, 20, 7, 23), options);
        chai_1.expect(response.results).to.be.lengthOf(1);
        chai_1.expect(response.results[0].diff.splitLines({ removeEmptyEntries: false, trim: false })).to.be.deep.equal(expectedDiff);
    }));
    test('Rename function in source with a trailing empty line', () => __awaiter(this, void 0, void 0, function* () {
        const sourceFile = path.join(constants_1.EXTENSION_ROOT_DIR, 'src', 'test', 'pythonFiles', 'refactoring', 'source folder', 'with empty line.py');
        const expectedDiff = `--- a/${path.basename(sourceFile)}${os_1.EOL}+++ b/${path.basename(sourceFile)}${os_1.EOL}@@ -1,8 +1,8 @@${os_1.EOL} import os${os_1.EOL} ${os_1.EOL}-def one():${os_1.EOL}+def three():${os_1.EOL}     return True${os_1.EOL} ${os_1.EOL} def two():${os_1.EOL}-    if one():${os_1.EOL}-        print(\"A\" + one())${os_1.EOL}+    if three():${os_1.EOL}+        print(\"A\" + three())${os_1.EOL}`
            .splitLines({ removeEmptyEntries: false, trim: false });
        const proxy = new proxy_1.RefactorProxy(constants_1.EXTENSION_ROOT_DIR, pythonSettings.object, path.dirname(sourceFile), serviceContainer.object);
        const textDocument = yield vscode_1.workspace.openTextDocument(sourceFile);
        yield vscode_1.window.showTextDocument(textDocument);
        const response = yield proxy.rename(textDocument, 'three', sourceFile, new vscode_1.Range(7, 20, 7, 23), options);
        chai_1.expect(response.results).to.be.lengthOf(1);
        chai_1.expect(response.results[0].diff.splitLines({ removeEmptyEntries: false, trim: false })).to.be.deep.equal(expectedDiff);
    }));
});
//# sourceMappingURL=rename.test.js.map