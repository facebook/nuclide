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
const path = require("path");
const vscode = require("vscode");
const constants_1 = require("../../client/common/constants");
const initialize_1 = require("../initialize");
const decoratorsPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'definition', 'navigation');
const fileDefinitions = path.join(decoratorsPath, 'definitions.py');
const fileUsages = path.join(decoratorsPath, 'usages.py');
// tslint:disable-next-line:max-func-body-length
suite('Definition Navigation', () => {
    suiteSetup(initialize_1.initialize);
    setup(initialize_1.initializeTest);
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(initialize_1.closeActiveWindows);
    const assertFile = (expectedLocation, location) => {
        const relLocation = vscode.workspace.asRelativePath(location);
        const expectedRelLocation = vscode.workspace.asRelativePath(expectedLocation);
        assert.equal(expectedRelLocation, relLocation, 'Position is in wrong file');
    };
    const formatPosition = (position) => {
        return `${position.line},${position.character}`;
    };
    const assertRange = (expectedRange, range) => {
        assert.equal(formatPosition(expectedRange.start), formatPosition(range.start), 'Start position is incorrect');
        assert.equal(formatPosition(expectedRange.end), formatPosition(range.end), 'End position is incorrect');
    };
    const buildTest = (startFile, startPosition, expectedFiles, expectedRanges) => {
        return () => __awaiter(this, void 0, void 0, function* () {
            const textDocument = yield vscode.workspace.openTextDocument(startFile);
            yield vscode.window.showTextDocument(textDocument);
            assert(vscode.window.activeTextEditor, 'No active editor');
            const locations = yield vscode.commands.executeCommand('vscode.executeDefinitionProvider', textDocument.uri, startPosition);
            assert.equal(expectedFiles.length, locations.length, 'Wrong number of results');
            for (let i = 0; i < locations.length; i += 1) {
                assertFile(expectedFiles[i], locations[i].uri);
                assertRange(expectedRanges[i], locations[i].range);
            }
        });
    };
    test('From own definition', buildTest(fileDefinitions, new vscode.Position(2, 6), [fileDefinitions], constants_1.isLanguageServerTest() ? [new vscode.Range(2, 4, 2, 16)] : [new vscode.Range(2, 0, 11, 17)]));
    test('Nested function', buildTest(fileDefinitions, new vscode.Position(11, 16), [fileDefinitions], constants_1.isLanguageServerTest() ? [new vscode.Range(6, 8, 6, 15)] : [new vscode.Range(6, 4, 10, 16)]));
    test('Decorator usage', buildTest(fileDefinitions, new vscode.Position(13, 1), [fileDefinitions], constants_1.isLanguageServerTest() ? [new vscode.Range(2, 4, 2, 16)] : [new vscode.Range(2, 0, 11, 17)]));
    test('Function decorated by stdlib', buildTest(fileDefinitions, new vscode.Position(29, 6), [fileDefinitions], constants_1.isLanguageServerTest() ? [new vscode.Range(21, 4, 21, 22)] : [new vscode.Range(21, 0, 27, 17)]));
    test('Function decorated by local decorator', buildTest(fileDefinitions, new vscode.Position(30, 6), [fileDefinitions], constants_1.isLanguageServerTest() ? [new vscode.Range(14, 4, 14, 9)] : [new vscode.Range(14, 0, 18, 7)]));
    test('Module imported decorator usage', buildTest(fileUsages, new vscode.Position(3, 15), [fileDefinitions], constants_1.isLanguageServerTest() ? [new vscode.Range(2, 4, 2, 16)] : [new vscode.Range(2, 0, 11, 17)]));
    test('Module imported function decorated by stdlib', buildTest(fileUsages, new vscode.Position(11, 19), [fileDefinitions], constants_1.isLanguageServerTest() ? [new vscode.Range(21, 4, 21, 22)] : [new vscode.Range(21, 0, 27, 17)]));
    test('Module imported function decorated by local decorator', buildTest(fileUsages, new vscode.Position(12, 19), [fileDefinitions], constants_1.isLanguageServerTest() ? [new vscode.Range(14, 4, 14, 9)] : [new vscode.Range(14, 0, 18, 7)]));
    test('Specifically imported decorator usage', buildTest(fileUsages, new vscode.Position(7, 1), constants_1.isLanguageServerTest() ? [fileDefinitions] : [fileDefinitions], constants_1.isLanguageServerTest()
        ? [new vscode.Range(2, 4, 2, 16)]
        : [new vscode.Range(2, 0, 11, 17)]));
    test('Specifically imported function decorated by stdlib', buildTest(fileUsages, new vscode.Position(14, 6), constants_1.isLanguageServerTest() ? [fileDefinitions] : [fileDefinitions], constants_1.isLanguageServerTest()
        ? [new vscode.Range(21, 4, 21, 22)]
        : [new vscode.Range(21, 0, 27, 17)]));
    test('Specifically imported function decorated by local decorator', buildTest(fileUsages, new vscode.Position(15, 6), constants_1.isLanguageServerTest() ? [fileDefinitions] : [fileDefinitions], constants_1.isLanguageServerTest()
        ? [new vscode.Range(14, 4, 14, 9)]
        : [new vscode.Range(14, 0, 18, 7)]));
});
//# sourceMappingURL=navigation.test.js.map