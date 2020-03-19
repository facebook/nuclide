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
const string_1 = require("../../../client/common/utils/string");
suite('splitParent()', () => {
    test('valid values', () => __awaiter(this, void 0, void 0, function* () {
        const tests = [
            ['x.y', ['x', 'y']],
            ['x', ['', 'x']],
            ['x.y.z', ['x.y', 'z']],
            ['', ['', '']]
        ];
        for (const [raw, expected] of tests) {
            const result = string_1.splitParent(raw);
            chai_1.expect(result).to.deep.equal(expected);
        }
    }));
});
//# sourceMappingURL=string.unit.test.js.map