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
const textRangeCollection_1 = require("../../client/language/textRangeCollection");
const types_1 = require("../../client/language/types");
// tslint:disable-next-line:max-func-body-length
suite('Language.TextRangeCollection', () => {
    test('Empty', () => __awaiter(this, void 0, void 0, function* () {
        const items = [];
        const c = new textRangeCollection_1.TextRangeCollection(items);
        assert.equal(c.start, 0);
        assert.equal(c.end, 0);
        assert.equal(c.length, 0);
        assert.equal(c.count, 0);
    }));
    test('Basic', () => __awaiter(this, void 0, void 0, function* () {
        const items = [];
        items.push(new types_1.TextRange(2, 1));
        items.push(new types_1.TextRange(4, 2));
        const c = new textRangeCollection_1.TextRangeCollection(items);
        assert.equal(c.start, 2);
        assert.equal(c.end, 6);
        assert.equal(c.length, 4);
        assert.equal(c.count, 2);
        assert.equal(c.getItemAt(0).start, 2);
        assert.equal(c.getItemAt(0).length, 1);
        assert.equal(c.getItemAt(1).start, 4);
        assert.equal(c.getItemAt(1).length, 2);
    }));
    test('Contains position (simple)', () => __awaiter(this, void 0, void 0, function* () {
        const items = [];
        items.push(new types_1.TextRange(2, 1));
        items.push(new types_1.TextRange(4, 2));
        const c = new textRangeCollection_1.TextRangeCollection(items);
        const results = [-1, -1, 0, -1, 1, 1, -1];
        for (let i = 0; i < results.length; i += 1) {
            const index = c.getItemContaining(i);
            assert.equal(index, results[i]);
        }
    }));
    test('Contains position (adjoint)', () => __awaiter(this, void 0, void 0, function* () {
        const items = [];
        items.push(new types_1.TextRange(2, 1));
        items.push(new types_1.TextRange(3, 2));
        const c = new textRangeCollection_1.TextRangeCollection(items);
        const results = [-1, -1, 0, 1, 1, -1, -1];
        for (let i = 0; i < results.length; i += 1) {
            const index = c.getItemContaining(i);
            assert.equal(index, results[i]);
        }
    }));
    test('Contains position (out of range)', () => __awaiter(this, void 0, void 0, function* () {
        const items = [];
        items.push(new types_1.TextRange(2, 1));
        items.push(new types_1.TextRange(4, 2));
        const c = new textRangeCollection_1.TextRangeCollection(items);
        const positions = [-100, -1, 10, 100];
        for (const p of positions) {
            const index = c.getItemContaining(p);
            assert.equal(index, -1);
        }
    }));
    test('Contains position (empty)', () => __awaiter(this, void 0, void 0, function* () {
        const items = [];
        const c = new textRangeCollection_1.TextRangeCollection(items);
        const positions = [-2, -1, 0, 1, 2, 3];
        for (const p of positions) {
            const index = c.getItemContaining(p);
            assert.equal(index, -1);
        }
    }));
    test('Item at position', () => __awaiter(this, void 0, void 0, function* () {
        const items = [];
        items.push(new types_1.TextRange(2, 1));
        items.push(new types_1.TextRange(4, 2));
        const c = new textRangeCollection_1.TextRangeCollection(items);
        const results = [-1, -1, 0, -1, 1, -1, -1];
        for (let i = 0; i < results.length; i += 1) {
            const index = c.getItemAtPosition(i);
            assert.equal(index, results[i]);
        }
    }));
});
//# sourceMappingURL=textRangeCollection.test.js.map