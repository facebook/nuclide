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
const assert = require("assert");
const TypeMoq = require("typemoq");
const dispatcher_1 = require("../../client/typeFormatters/dispatcher");
suite('Formatting - Dispatcher', () => {
    const doc = TypeMoq.Mock.ofType();
    const pos = TypeMoq.Mock.ofType();
    const opt = TypeMoq.Mock.ofType();
    const token = TypeMoq.Mock.ofType();
    const edits = TypeMoq.Mock.ofType();
    test('No providers', () => __awaiter(this, void 0, void 0, function* () {
        const dispatcher = new dispatcher_1.OnTypeFormattingDispatcher({});
        const triggers = dispatcher.getTriggerCharacters();
        assert.equal(triggers, undefined, 'Trigger was not undefined');
        const result = yield dispatcher.provideOnTypeFormattingEdits(doc.object, pos.object, '\n', opt.object, token.object);
        assert.deepStrictEqual(result, [], 'Did not return an empty list of edits');
    }));
    test('Single provider', () => {
        const provider = setupProvider(doc.object, pos.object, ':', opt.object, token.object, edits.object);
        const dispatcher = new dispatcher_1.OnTypeFormattingDispatcher({
            ':': provider.object
        });
        const triggers = dispatcher.getTriggerCharacters();
        assert.deepStrictEqual(triggers, { first: ':', more: [] }, 'Did not return correct triggers');
        const result = dispatcher.provideOnTypeFormattingEdits(doc.object, pos.object, ':', opt.object, token.object);
        assert.equal(result, edits.object, 'Did not return correct edits');
        provider.verifyAll();
    });
    test('Two providers', () => {
        const colonProvider = setupProvider(doc.object, pos.object, ':', opt.object, token.object, edits.object);
        const doc2 = TypeMoq.Mock.ofType();
        const pos2 = TypeMoq.Mock.ofType();
        const opt2 = TypeMoq.Mock.ofType();
        const token2 = TypeMoq.Mock.ofType();
        const edits2 = TypeMoq.Mock.ofType();
        const newlineProvider = setupProvider(doc2.object, pos2.object, '\n', opt2.object, token2.object, edits2.object);
        const dispatcher = new dispatcher_1.OnTypeFormattingDispatcher({
            ':': colonProvider.object,
            '\n': newlineProvider.object
        });
        const triggers = dispatcher.getTriggerCharacters();
        assert.deepStrictEqual(triggers, { first: '\n', more: [':'] }, 'Did not return correct triggers');
        const result = dispatcher.provideOnTypeFormattingEdits(doc.object, pos.object, ':', opt.object, token.object);
        assert.equal(result, edits.object, 'Did not return correct editsfor colon provider');
        const result2 = dispatcher.provideOnTypeFormattingEdits(doc2.object, pos2.object, '\n', opt2.object, token2.object);
        assert.equal(result2, edits2.object, 'Did not return correct edits for newline provider');
        colonProvider.verifyAll();
        newlineProvider.verifyAll();
    });
    function setupProvider(document, position, ch, options, cancellationToken, result) {
        const provider = TypeMoq.Mock.ofType();
        provider.setup(p => p.provideOnTypeFormattingEdits(document, position, ch, options, cancellationToken))
            .returns(() => result)
            .verifiable(TypeMoq.Times.once());
        return provider;
    }
});
//# sourceMappingURL=extension.dispatch.test.js.map