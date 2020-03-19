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
const types_1 = require("../../client/language/types");
// tslint:disable-next-line:max-func-body-length
suite('Language.TextRange', () => {
    test('Empty static', () => __awaiter(this, void 0, void 0, function* () {
        const e = types_1.TextRange.empty;
        assert.equal(e.start, 0);
        assert.equal(e.end, 0);
        assert.equal(e.length, 0);
    }));
    test('Construction', () => __awaiter(this, void 0, void 0, function* () {
        let r = new types_1.TextRange(10, 20);
        assert.equal(r.start, 10);
        assert.equal(r.end, 30);
        assert.equal(r.length, 20);
        r = new types_1.TextRange(10, 0);
        assert.equal(r.start, 10);
        assert.equal(r.end, 10);
        assert.equal(r.length, 0);
    }));
    test('From bounds', () => __awaiter(this, void 0, void 0, function* () {
        let r = types_1.TextRange.fromBounds(7, 9);
        assert.equal(r.start, 7);
        assert.equal(r.end, 9);
        assert.equal(r.length, 2);
        r = types_1.TextRange.fromBounds(5, 5);
        assert.equal(r.start, 5);
        assert.equal(r.end, 5);
        assert.equal(r.length, 0);
    }));
    test('Contains', () => __awaiter(this, void 0, void 0, function* () {
        const r = types_1.TextRange.fromBounds(7, 9);
        assert.equal(r.contains(-1), false);
        assert.equal(r.contains(6), false);
        assert.equal(r.contains(7), true);
        assert.equal(r.contains(8), true);
        assert.equal(r.contains(9), false);
        assert.equal(r.contains(10), false);
    }));
    test('Exceptions', () => __awaiter(this, void 0, void 0, function* () {
        assert.throws(() => { const e = new types_1.TextRange(0, -1); }, Error);
        assert.throws(() => { const e = types_1.TextRange.fromBounds(3, 1); }, Error);
    }));
});
//# sourceMappingURL=textRange.test.js.map