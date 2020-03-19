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
const textIterator_1 = require("../../client/language/textIterator");
// tslint:disable-next-line:max-func-body-length
suite('Language.TextIterator', () => {
    test('Construction', () => __awaiter(this, void 0, void 0, function* () {
        const content = 'some text';
        const ti = new textIterator_1.TextIterator(content);
        assert.equal(ti.length, content.length);
        assert.equal(ti.getText(), content);
    }));
    test('Iteration', () => __awaiter(this, void 0, void 0, function* () {
        const content = 'some text';
        const ti = new textIterator_1.TextIterator(content);
        for (let i = -2; i < content.length + 2; i += 1) {
            const ch = ti.charCodeAt(i);
            if (i < 0 || i >= content.length) {
                assert.equal(ch, 0);
            }
            else {
                assert.equal(ch, content.charCodeAt(i));
            }
        }
    }));
});
//# sourceMappingURL=textIterator.test.js.map