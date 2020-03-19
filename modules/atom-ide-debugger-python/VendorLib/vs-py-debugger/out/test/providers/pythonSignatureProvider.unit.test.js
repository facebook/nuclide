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
// tslint:disable:max-func-body-length
const chai_1 = require("chai");
const chaipromise = require("chai-as-promised");
const TypeMoq = require("typemoq");
const vscode_1 = require("vscode");
const jediProxyFactory_1 = require("../../client/languageServices/jediProxyFactory");
const providerUtilities_1 = require("../../client/providers/providerUtilities");
const signatureProvider_1 = require("../../client/providers/signatureProvider");
chai_1.use(chaipromise);
suite('Signature Provider unit tests', () => {
    let pySignatureProvider;
    let jediHandler;
    let argResultItems;
    setup(() => {
        const jediFactory = TypeMoq.Mock.ofType(jediProxyFactory_1.JediFactory);
        jediHandler = TypeMoq.Mock.ofType();
        jediFactory.setup(j => j.getJediProxyHandler(TypeMoq.It.isAny()))
            .returns(() => jediHandler.object);
        pySignatureProvider = new signatureProvider_1.PythonSignatureProvider(jediFactory.object);
        argResultItems = {
            definitions: [
                {
                    description: 'The result',
                    docstring: 'Some docstring goes here.',
                    name: 'print',
                    paramindex: 0,
                    params: [
                        {
                            description: 'Some parameter',
                            docstring: 'gimme docs',
                            name: 'param',
                            value: 'blah'
                        }
                    ]
                }
            ],
            requestId: 1
        };
    });
    function testSignatureReturns(source, pos) {
        const doc = TypeMoq.Mock.ofType();
        const position = new vscode_1.Position(0, pos);
        const lineText = TypeMoq.Mock.ofType();
        const argsResult = TypeMoq.Mock.ofType();
        const cancelToken = TypeMoq.Mock.ofType();
        cancelToken.setup(ct => ct.isCancellationRequested).returns(() => false);
        doc.setup(d => d.fileName).returns(() => '');
        doc.setup(d => d.getText(TypeMoq.It.isAny())).returns(() => source);
        doc.setup(d => d.lineAt(TypeMoq.It.isAny())).returns(() => lineText.object);
        doc.setup(d => d.offsetAt(TypeMoq.It.isAny())).returns(() => pos - 1); // pos is 1-based
        const docUri = TypeMoq.Mock.ofType();
        docUri.setup(u => u.scheme).returns(() => 'http');
        doc.setup(d => d.uri).returns(() => docUri.object);
        lineText.setup(l => l.text).returns(() => source);
        argsResult.setup(c => c.requestId).returns(() => 1);
        argsResult.setup(c => c.definitions).returns(() => argResultItems[0].definitions);
        jediHandler.setup(j => j.sendCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
            return Promise.resolve(argResultItems);
        });
        return pySignatureProvider.provideSignatureHelp(doc.object, position, cancelToken.object);
    }
    function testIsInsideStringOrComment(sourceLine, sourcePos) {
        const textLine = TypeMoq.Mock.ofType();
        textLine.setup(t => t.text).returns(() => sourceLine);
        const doc = TypeMoq.Mock.ofType();
        const pos = new vscode_1.Position(1, sourcePos);
        doc.setup(d => d.fileName).returns(() => '');
        doc.setup(d => d.getText(TypeMoq.It.isAny())).returns(() => sourceLine);
        doc.setup(d => d.lineAt(TypeMoq.It.isAny())).returns(() => textLine.object);
        doc.setup(d => d.offsetAt(TypeMoq.It.isAny())).returns(() => sourcePos);
        return providerUtilities_1.isPositionInsideStringOrComment(doc.object, pos);
    }
    test('Ensure no signature is given within a string.', () => __awaiter(this, void 0, void 0, function* () {
        const source = '  print(\'Python is awesome,\')\n';
        const sigHelp = yield testSignatureReturns(source, 27);
        chai_1.expect(sigHelp).to.not.be.equal(undefined, 'Expected to get a blank signature item back - did the pattern change here?');
        chai_1.expect(sigHelp.signatures.length).to.equal(0, 'Signature provided for symbols within a string?');
    }));
    test('Ensure no signature is given within a line comment.', () => __awaiter(this, void 0, void 0, function* () {
        const source = '#  print(\'Python is awesome,\')\n';
        const sigHelp = yield testSignatureReturns(source, 28);
        chai_1.expect(sigHelp).to.not.be.equal(undefined, 'Expected to get a blank signature item back - did the pattern change here?');
        chai_1.expect(sigHelp.signatures.length).to.equal(0, 'Signature provided for symbols within a full-line comment?');
    }));
    test('Ensure no signature is given within a comment tailing a command.', () => __awaiter(this, void 0, void 0, function* () {
        const source = '  print(\'Python\') # print(\'is awesome,\')\n';
        const sigHelp = yield testSignatureReturns(source, 38);
        chai_1.expect(sigHelp).to.not.be.equal(undefined, 'Expected to get a blank signature item back - did the pattern change here?');
        chai_1.expect(sigHelp.signatures.length).to.equal(0, 'Signature provided for symbols within a trailing comment?');
    }));
    test('Ensure signature is given for built-in print command.', () => __awaiter(this, void 0, void 0, function* () {
        const source = '  print(\'Python\',)\n';
        let sigHelp;
        try {
            sigHelp = yield testSignatureReturns(source, 18);
            chai_1.expect(sigHelp).to.not.equal(undefined, 'Expected to get a blank signature item back - did the pattern change here?');
            chai_1.expect(sigHelp.signatures.length).to.not.equal(0, 'Expected dummy argresult back from testing our print signature.');
            chai_1.expect(sigHelp.activeParameter).to.be.equal(0, 'Parameter for print should be the first member of the test argresult\'s params object.');
            chai_1.expect(sigHelp.activeSignature).to.be.equal(0, 'The signature for print should be the first member of the test argresult.');
            chai_1.expect(sigHelp.signatures[sigHelp.activeSignature].label).to.be.equal('print(param)', `Expected arg result calls for specific returned signature of \'print(param)\' but we got ${sigHelp.signatures[sigHelp.activeSignature].label}`);
        }
        catch (error) {
            chai_1.assert(false, `Caught exception ${error}`);
        }
    }));
    test('Ensure isPositionInsideStringOrComment is behaving as expected.', () => {
        const sourceLine = '  print(\'Hello world!\')\n';
        const sourcePos = sourceLine.length - 1;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.not.be.equal(true, [
            `Position set to the end of ${sourceLine} but `,
            'is reported as being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at end of source.', () => {
        const sourceLine = '  print(\'Hello world!\')\n';
        const sourcePos = 0;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.not.be.equal(true, [
            `Position set to the end of ${sourceLine} but `,
            'is reported as being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at beginning of source.', () => {
        const sourceLine = '  print(\'Hello world!\')\n';
        const sourcePos = 0;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.not.be.equal(true, [
            `Position set to the beginning of ${sourceLine} but `,
            'is reported as being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a string.', () => {
        const sourceLine = '  print(\'Hello world!\')\n';
        const sourcePos = 16;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within the string in ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected immediately before a string.', () => {
        const sourceLine = '  print(\'Hello world!\')\n';
        const sourcePos = 8;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(false, [
            `Position set to just before the string in ${sourceLine} (position ${sourcePos}) but `,
            'is reported as being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected immediately in a string.', () => {
        const sourceLine = '  print(\'Hello world!\')\n';
        const sourcePos = 9;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set to the start of the string in ${sourceLine} (position ${sourcePos}) but `,
            'is reported as being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a comment.', () => {
        const sourceLine = '#  print(\'Hello world!\')\n';
        const sourcePos = 16;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within a full line comment ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a trailing comment.', () => {
        const sourceLine = '  print(\'Hello world!\') # some comment...\n';
        const sourcePos = 34;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within a trailing line comment ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at the very end of a trailing comment.', () => {
        const sourceLine = '  print(\'Hello world!\') # some comment...\n';
        const sourcePos = sourceLine.length - 1;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within a trailing line comment ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a multiline string.', () => {
        const sourceLine = '  stringVal = \'\'\'This is a multiline\nstring that you can use\nto test this stuff out with\neveryday!\'\'\'\n';
        const sourcePos = 48;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at the very last quote on a multiline string.', () => {
        const sourceLine = '  stringVal = \'\'\'This is a multiline\nstring that you can use\nto test this stuff out with\neveryday!\'\'\'\n';
        const sourcePos = sourceLine.length - 2; // just at the last '
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected within a multiline string (double-quoted).', () => {
        const sourceLine = '  stringVal = """This is a multiline\nstring that you can use\nto test this stuff out with\neveryday!"""\n';
        const sourcePos = 48;
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected at the very last quote on a multiline string (double-quoted).', () => {
        const sourceLine = '  stringVal = """This is a multiline\nstring that you can use\nto test this stuff out with\neveryday!"""\n';
        const sourcePos = sourceLine.length - 2; // just at the last '
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
    test('Ensure isPositionInsideStringOrComment is behaving as expected during construction of a multiline string (double-quoted).', () => {
        const sourceLine = '  stringVal = """This is a multiline\nstring that you can use\nto test this stuff';
        const sourcePos = sourceLine.length - 1; // just at the last position in the string before it's termination
        const isInsideStrComment = testIsInsideStringOrComment(sourceLine, sourcePos);
        chai_1.expect(isInsideStrComment).to.be.equal(true, [
            `Position set within a multi-line string ${sourceLine} (position ${sourcePos}) but `,
            'is reported as NOT being within a string or comment.'
        ].join(''));
    });
});
//# sourceMappingURL=pythonSignatureProvider.unit.test.js.map