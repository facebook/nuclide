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
const path = require("path");
const vscode = require("vscode");
const common_1 = require("../common");
const constants_1 = require("../constants");
const initialize_1 = require("../initialize");
const serviceRegistry_1 = require("../unittests/serviceRegistry");
const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'signature');
class SignatureHelpResult {
    constructor(line, index, signaturesCount, activeParameter, parameterName) {
        this.line = line;
        this.index = index;
        this.signaturesCount = signaturesCount;
        this.activeParameter = activeParameter;
        this.parameterName = parameterName;
    }
}
// tslint:disable-next-line:max-func-body-length
suite('Signatures (Language Server)', () => {
    let isPython2;
    let ioc;
    suiteSetup(function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constants_1.IsLanguageServerTest()) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            yield initialize_1.initialize();
            initializeDI();
            isPython2 = (yield ioc.getPythonMajorVersion(common_1.rootWorkspaceUri)) === 2;
        });
    });
    setup(initialize_1.initializeTest);
    suiteTeardown(initialize_1.closeActiveWindows);
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        yield initialize_1.closeActiveWindows();
        ioc.dispose();
    }));
    function initializeDI() {
        ioc = new serviceRegistry_1.UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }
    test('For ctor', () => __awaiter(this, void 0, void 0, function* () {
        const expected = [
            new SignatureHelpResult(5, 11, 1, -1, null),
            new SignatureHelpResult(5, 12, 1, 0, 'name'),
            new SignatureHelpResult(5, 13, 1, 0, 'name'),
            new SignatureHelpResult(5, 14, 1, 0, 'name'),
            new SignatureHelpResult(5, 15, 1, 0, 'name'),
            new SignatureHelpResult(5, 16, 1, 0, 'name'),
            new SignatureHelpResult(5, 17, 1, 0, 'name'),
            new SignatureHelpResult(5, 18, 1, 1, 'age'),
            new SignatureHelpResult(5, 19, 1, 1, 'age'),
            new SignatureHelpResult(5, 20, 1, -1, null)
        ];
        const document = yield openDocument(path.join(autoCompPath, 'classCtor.py'));
        for (let i = 0; i < expected.length; i += 1) {
            yield checkSignature(expected[i], document.uri, i);
        }
    }));
    test('For intrinsic', () => __awaiter(this, void 0, void 0, function* () {
        const expected = [
            new SignatureHelpResult(0, 0, 1, -1, null),
            new SignatureHelpResult(0, 1, 1, -1, null),
            new SignatureHelpResult(0, 2, 1, -1, null),
            new SignatureHelpResult(0, 3, 1, -1, null),
            new SignatureHelpResult(0, 4, 1, -1, null),
            new SignatureHelpResult(0, 5, 1, -1, null),
            new SignatureHelpResult(0, 6, 1, 0, 'start'),
            new SignatureHelpResult(0, 7, 1, 0, 'start'),
            new SignatureHelpResult(0, 8, 1, 1, 'stop'),
            new SignatureHelpResult(0, 9, 1, 1, 'stop'),
            new SignatureHelpResult(0, 10, 1, 1, 'stop'),
            new SignatureHelpResult(0, 11, 1, 2, 'step')
        ];
        const document = yield openDocument(path.join(autoCompPath, 'basicSig.py'));
        for (let i = 0; i < expected.length; i += 1) {
            yield checkSignature(expected[i], document.uri, i);
        }
    }));
    test('For ellipsis', function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (isPython2) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
                return;
            }
            const expected = [
                new SignatureHelpResult(0, 5, 1, -1, null),
                new SignatureHelpResult(0, 6, 1, 0, 'value'),
                new SignatureHelpResult(0, 7, 1, 0, 'value'),
                new SignatureHelpResult(0, 8, 1, 1, '...'),
                new SignatureHelpResult(0, 9, 1, 1, '...'),
                new SignatureHelpResult(0, 10, 1, 1, '...'),
                new SignatureHelpResult(0, 11, 1, 2, 'sep'),
                new SignatureHelpResult(0, 12, 1, 2, 'sep')
            ];
            const document = yield openDocument(path.join(autoCompPath, 'ellipsis.py'));
            for (let i = 0; i < expected.length; i += 1) {
                yield checkSignature(expected[i], document.uri, i);
            }
        });
    });
    test('For pow', () => __awaiter(this, void 0, void 0, function* () {
        let expected;
        if (isPython2) {
            expected = new SignatureHelpResult(0, 4, 1, 0, 'x');
        }
        else {
            expected = new SignatureHelpResult(0, 4, 1, 0, null);
        }
        const document = yield openDocument(path.join(autoCompPath, 'noSigPy3.py'));
        yield checkSignature(expected, document.uri, 0);
    }));
});
function openDocument(documentPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const document = yield vscode.workspace.openTextDocument(documentPath);
        yield vscode.window.showTextDocument(document);
        return document;
    });
}
function checkSignature(expected, uri, caseIndex) {
    return __awaiter(this, void 0, void 0, function* () {
        const position = new vscode.Position(expected.line, expected.index);
        const actual = yield vscode.commands.executeCommand('vscode.executeSignatureHelpProvider', uri, position);
        assert.equal(actual.signatures.length, expected.signaturesCount, `Signature count does not match, case ${caseIndex}`);
        if (expected.signaturesCount > 0) {
            assert.equal(actual.activeParameter, expected.activeParameter, `Parameter index does not match, case ${caseIndex}`);
            if (expected.parameterName) {
                const parameter = actual.signatures[0].parameters[expected.activeParameter];
                assert.equal(parameter.label, expected.parameterName, `Parameter name is incorrect, case ${caseIndex}`);
            }
        }
    });
}
//# sourceMappingURL=signature.ls.test.js.map