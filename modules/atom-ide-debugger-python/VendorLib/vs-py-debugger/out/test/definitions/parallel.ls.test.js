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
const assert = require("assert");
const os_1 = require("os");
const path = require("path");
const vscode = require("vscode");
const constants_1 = require("../../client/common/platform/constants");
const constants_2 = require("../constants");
const initialize_1 = require("../initialize");
const textUtils_1 = require("../textUtils");
const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const fileOne = path.join(autoCompPath, 'one.py');
suite('Code, Hover Definition and Intellisense (Language Server)', () => {
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            // https://github.com/Microsoft/vscode-python/issues/1061
            // tslint:disable-next-line:no-invalid-this
            this.skip();
            if (!constants_2.IsLanguageServerTest()) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            yield initialize_1.initialize();
        });
    });
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(initialize_1.closeActiveWindows);
    test('All three together', () => __awaiter(this, void 0, void 0, function* () {
        const textDocument = yield vscode.workspace.openTextDocument(fileOne);
        let position = new vscode.Position(30, 5);
        const hoverDef = yield vscode.commands.executeCommand('vscode.executeHoverProvider', textDocument.uri, position);
        const codeDef = yield vscode.commands.executeCommand('vscode.executeDefinitionProvider', textDocument.uri, position);
        position = new vscode.Position(3, 10);
        const list = yield vscode.commands.executeCommand('vscode.executeCompletionItemProvider', textDocument.uri, position);
        assert.equal(list.items.filter(item => item.label === 'api_version').length, 1, 'api_version not found');
        assert.equal(codeDef.length, 1, 'Definition length is incorrect');
        const expectedPath = constants_1.IS_WINDOWS ? fileOne.toUpperCase() : fileOne;
        const actualPath = constants_1.IS_WINDOWS ? codeDef[0].uri.fsPath.toUpperCase() : codeDef[0].uri.fsPath;
        assert.equal(actualPath, expectedPath, 'Incorrect file');
        assert.equal(`${codeDef[0].range.start.line},${codeDef[0].range.start.character}`, '17,4', 'Start position is incorrect');
        assert.equal(`${codeDef[0].range.end.line},${codeDef[0].range.end.character}`, '21,11', 'End position is incorrect');
        assert.equal(hoverDef.length, 1, 'Definition length is incorrect');
        assert.equal(`${hoverDef[0].range.start.line},${hoverDef[0].range.start.character}`, '30,4', 'Start position is incorrect');
        assert.equal(`${hoverDef[0].range.end.line},${hoverDef[0].range.end.character}`, '30,11', 'End position is incorrect');
        assert.equal(hoverDef[0].contents.length, 1, 'Invalid content items');
        // tslint:disable-next-line:prefer-template
        const expectedContent = '```python' + os_1.EOL + 'def method1()' + os_1.EOL + '```' + os_1.EOL + 'This is method1';
        assert.equal(textUtils_1.normalizeMarkedString(hoverDef[0].contents[0]), expectedContent, 'function signature incorrect');
    }));
});
//# sourceMappingURL=parallel.ls.test.js.map