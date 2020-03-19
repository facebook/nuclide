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
// tslint:disable:max-func-body-length no-any no-require-imports no-var-requires
const chai_1 = require("chai");
const vscode_1 = require("vscode");
const text_1 = require("../../../client/common/utils/text");
suite('parseRange()', () => {
    test('valid strings', () => __awaiter(this, void 0, void 0, function* () {
        const tests = [
            ['1:5-3:5', new vscode_1.Range(new vscode_1.Position(1, 5), new vscode_1.Position(3, 5))],
            ['1:5-3:3', new vscode_1.Range(new vscode_1.Position(1, 5), new vscode_1.Position(3, 3))],
            ['1:3-3:5', new vscode_1.Range(new vscode_1.Position(1, 3), new vscode_1.Position(3, 5))],
            ['1-3:5', new vscode_1.Range(new vscode_1.Position(1, 0), new vscode_1.Position(3, 5))],
            ['1-3', new vscode_1.Range(new vscode_1.Position(1, 0), new vscode_1.Position(3, 0))],
            ['1-1', new vscode_1.Range(new vscode_1.Position(1, 0), new vscode_1.Position(1, 0))],
            ['1', new vscode_1.Range(new vscode_1.Position(1, 0), new vscode_1.Position(1, 0))],
            ['1:3-', new vscode_1.Range(new vscode_1.Position(1, 3), new vscode_1.Position(0, 0) // ???
                )],
            ['1:3', new vscode_1.Range(new vscode_1.Position(1, 3), new vscode_1.Position(1, 3))],
            ['', new vscode_1.Range(new vscode_1.Position(0, 0), new vscode_1.Position(0, 0))],
            ['3-1', new vscode_1.Range(new vscode_1.Position(3, 0), new vscode_1.Position(1, 0))]
        ];
        for (const [raw, expected] of tests) {
            const result = text_1.parseRange(raw);
            chai_1.expect(result).to.deep.equal(expected);
        }
    }));
    test('valid numbers', () => __awaiter(this, void 0, void 0, function* () {
        const tests = [
            [1, new vscode_1.Range(new vscode_1.Position(1, 0), new vscode_1.Position(1, 0))]
        ];
        for (const [raw, expected] of tests) {
            const result = text_1.parseRange(raw);
            chai_1.expect(result).to.deep.equal(expected);
        }
    }));
    test('bad strings', () => __awaiter(this, void 0, void 0, function* () {
        const tests = [
            '1-2-3',
            '1:4-2-3',
            '1-2:4-3',
            '1-2-3:4',
            '1:2:3',
            '1:2:3-4',
            '1-2:3:4',
            '1:2:3-4:5:6',
            '1-a',
            '1:2-a',
            '1-a:2',
            '1:2-a:2',
            'a-1',
            'a-b',
            'a',
            'a:1',
            'a:b'
        ];
        for (const raw of tests) {
            chai_1.expect(() => text_1.parseRange(raw)).to.throw();
        }
    }));
});
suite('parsePosition()', () => {
    test('valid strings', () => __awaiter(this, void 0, void 0, function* () {
        const tests = [
            ['1:5', new vscode_1.Position(1, 5)],
            ['1', new vscode_1.Position(1, 0)],
            ['', new vscode_1.Position(0, 0)]
        ];
        for (const [raw, expected] of tests) {
            const result = text_1.parsePosition(raw);
            chai_1.expect(result).to.deep.equal(expected);
        }
    }));
    test('valid numbers', () => __awaiter(this, void 0, void 0, function* () {
        const tests = [
            [1, new vscode_1.Position(1, 0)]
        ];
        for (const [raw, expected] of tests) {
            const result = text_1.parsePosition(raw);
            chai_1.expect(result).to.deep.equal(expected);
        }
    }));
    test('bad strings', () => __awaiter(this, void 0, void 0, function* () {
        const tests = [
            '1:2:3',
            '1:a',
            'a'
        ];
        for (const raw of tests) {
            chai_1.expect(() => text_1.parsePosition(raw)).to.throw();
        }
    }));
});
//# sourceMappingURL=text.unit.test.js.map